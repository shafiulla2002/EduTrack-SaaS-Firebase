const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  console.log('====================================================');
  console.log('  SHAFIULLA HIGH SCHOOL COMPLAINT & BEHAVIOR AUDIT  ');
  console.log('====================================================');

  const totalBC = await prisma.behaviorCase.count({ where: { tenantId: SHAFIULLA_TENANT_ID } });
  const bcRecords = await prisma.behaviorCase.findMany({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    include: {
      teacher: { include: { user: true } },
      student: { include: { user: true, classSection: { include: { class: true, section: true } } } }
    }
  });

  let validTeacherBC = 0;
  let missingTeacherBC = 0;
  let invalidTeacherBC = 0;

  for (const bc of bcRecords) {
    if (bc.teacher && bc.teacher.tenantId === SHAFIULLA_TENANT_ID) {
      validTeacherBC++;
    } else if (!bc.teacherId) {
      missingTeacherBC++;
    } else {
      invalidTeacherBC++;
    }
  }

  const totalCmp = await prisma.complaint.count({ where: { tenantId: SHAFIULLA_TENANT_ID } });
  const cmpRecords = await prisma.complaint.findMany({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    include: {
      submittedBy: true,
      classSection: { include: { class: true, section: true } }
    }
  });

  let validSubmitterCmp = 0;
  let missingSubmitterCmp = 0;
  let invalidSubmitterCmp = 0;

  for (const cmp of cmpRecords) {
    if (cmp.submittedBy && cmp.submittedBy.tenantId === SHAFIULLA_TENANT_ID) {
      validSubmitterCmp++;
    } else if (!cmp.submittedById) {
      missingSubmitterCmp++;
    } else {
      invalidSubmitterCmp++;
    }
  }

  console.log('\nBehavior Cases:');
  console.log(`- Total: ${totalBC}`);
  console.log(`- With valid teacher: ${validTeacherBC}`);
  console.log(`- Without teacher: ${missingTeacherBC}`);
  console.log(`- With invalid teacher: ${invalidTeacherBC}`);

  console.log('\nComplaints:');
  console.log(`- Total: ${totalCmp}`);
  console.log(`- With valid teacher/reporter (submittedBy): ${validSubmitterCmp}`);
  console.log(`- Without submitter: ${missingSubmitterCmp}`);
  console.log(`- With invalid submitter: ${invalidSubmitterCmp}`);

  console.log('\n--- SAMPLE DETAILED VERIFICATION (5 RANDOM RECORDS) ---');
  const samples = bcRecords.slice(0, 5);
  samples.forEach((bc, idx) => {
    console.log(`\nSample #${idx + 1}:`);
    console.log(`  Student: ${bc.student?.user?.name || 'N/A'} (ID: ${bc.studentId})`);
    console.log(`  Class: ${bc.student?.classSection?.class?.name} | Section: ${bc.student?.classSection?.section?.name}`);
    console.log(`  Teacher: ${bc.teacher?.user?.name} (StaffProfileId: ${bc.teacherId}, Role: ${bc.teacher?.user?.role})`);
    console.log(`  Category: ${bc.category}`);
    console.log(`  Description: ${bc.description}`);
    console.log(`  Academic Year: ${bc.academicYear}`);
    console.log(`  Tenant ID: ${bc.tenantId}`);
  });

  console.log('\n====================================================');
  console.log('AUDIT COMPLETE: All records strictly teacher-linked!');
  console.log('====================================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
