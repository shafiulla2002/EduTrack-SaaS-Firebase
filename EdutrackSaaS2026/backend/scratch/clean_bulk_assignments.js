/**
 * safe, tenant-scoped, reviewable, idempotent cleanup script
 * for unintended automatic/bulk teacher assignment records.
 *
 * Usage:
 *   Dry Run (default):
 *     node scratch/clean_bulk_assignments.js --dry-run
 *
 *   Execute for a specific tenant:
 *     node scratch/clean_bulk_assignments.js --execute --tenant-id=<TENANT_ID>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = !isExecute || args.includes('--dry-run');

  const tenantIdArg = args.find(a => a.startsWith('--tenant-id='))?.split('=')[1];

  console.log('====================================================');
  console.log('   EduTrack SaaS — Bulk Assignment Cleanup Tool     ');
  console.log('====================================================');
  console.log(` Mode: ${isDryRun ? 'DRY-RUN (No changes will be made)' : 'EXECUTE (Deleting confirmed bulk records)'}`);
  if (tenantIdArg) {
    console.log(` Target Tenant ID: ${tenantIdArg}`);
  } else {
    console.log(' Target Tenant ID: All Tenants (Scan Mode)');
  }
  console.log('====================================================\n');

  const tenants = await prisma.tenant.findMany({
    where: tenantIdArg ? { id: tenantIdArg } : {}
  });

  if (tenants.length === 0) {
    console.log('No matching tenant found.');
    return;
  }

  for (const tenant of tenants) {
    console.log(`\nAnalyzing Tenant: "${tenant.name}" (${tenant.id})`);

    const classSectionCount = await prisma.classSection.count({ where: { tenantId: tenant.id } });
    const teacherCount = await prisma.staffProfile.count({
      where: {
        tenantId: tenant.id,
        user: { role: 'TEACHER' }
      }
    });

    const allAssignments = await prisma.teacherAssignment.findMany({
      where: { tenantId: tenant.id },
      include: {
        teacher: { include: { user: true } },
        classSection: { include: { class: true, section: true } },
        subject: true,
      }
    });

    console.log(`  Total Teachers: ${teacherCount}`);
    console.log(`  Total Class Sections: ${classSectionCount}`);
    console.log(`  Total Teacher Assignments: ${allAssignments.length}`);

    if (allAssignments.length === 0) {
      console.log('  No assignments found for this tenant.');
      continue;
    }

    // Group assignments by teacher and classSection
    const teacherClassCountMap = new Map();
    const sectionTeacherCountMap = new Map();

    for (const assign of allAssignments) {
      const tId = assign.teacherId;
      const csId = assign.classSectionId;

      if (!teacherClassCountMap.has(tId)) {
        teacherClassCountMap.set(tId, new Set());
      }
      teacherClassCountMap.get(tId).add(csId);

      if (!sectionTeacherCountMap.has(csId)) {
        sectionTeacherCountMap.set(csId, new Set());
      }
      sectionTeacherCountMap.get(csId).add(tId);
    }

    // Identify bulk assignments:
    // Bulk pattern occurs when teachers are assigned to nearly ALL class sections (> 50% of total class sections)
    // AND sections have nearly ALL teachers assigned to them.
    const bulkAssignmentIds = [];
    const legitimateAssignmentIds = [];

    for (const assign of allAssignments) {
      const classesAssignedToTeacher = teacherClassCountMap.get(assign.teacherId)?.size || 0;
      const teachersAssignedToSection = sectionTeacherCountMap.get(assign.classSectionId)?.size || 0;

      // If a teacher is assigned to > 10 class sections AND class section has > 5 teachers assigned identically
      if (classesAssignedToTeacher >= 10 && teachersAssignedToSection >= 5) {
        bulkAssignmentIds.push(assign.id);
      } else {
        legitimateAssignmentIds.push(assign.id);
      }
    }

    console.log(`  Potential Automatic Bulk Assignments: ${bulkAssignmentIds.length}`);
    console.log(`  Legitimate/Specific Assignments: ${legitimateAssignmentIds.length}`);

    if (isDryRun) {
      console.log(`  [DRY RUN] No records deleted for tenant "${tenant.name}".`);
      console.log('  To delete bulk assignments, run:');
      console.log(`  node scratch/clean_bulk_assignments.js --execute --tenant-id=${tenant.id}\n`);
    } else {
      if (!tenantIdArg) {
        console.log('  [SAFETY ERROR] --execute requires an explicit --tenant-id=<TENANT_ID> argument.');
        continue;
      }

      if (bulkAssignmentIds.length === 0) {
        console.log('  No bulk assignments to clean up.');
        continue;
      }

      console.log(`  [EXECUTE] Removing ${bulkAssignmentIds.length} bulk assignment records...`);

      const deleteResult = await prisma.teacherAssignment.deleteMany({
        where: {
          id: { in: bulkAssignmentIds },
          tenantId: tenant.id
        }
      });

      console.log(`  SUCCESS: Removed ${deleteResult.count} unintended bulk assignment records.`);
      
      const remainingCount = await prisma.teacherAssignment.count({ where: { tenantId: tenant.id } });
      console.log(`  Remaining Assignments for tenant "${tenant.name}": ${remainingCount}\n`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
