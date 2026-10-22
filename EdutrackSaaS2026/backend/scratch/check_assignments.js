const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('    EduTrack SaaS — Assignment Verification Audit   ');
  console.log('====================================================\n');

  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    console.log(`Tenant: "${tenant.name}" (${tenant.id})`);

    const teacherCount = await prisma.staffProfile.count({
      where: { tenantId: tenant.id, user: { role: 'TEACHER' } }
    });

    const classSectionCount = await prisma.classSection.count({
      where: { tenantId: tenant.id }
    });

    const subjectCount = await prisma.subject.count({
      where: { tenantId: tenant.id }
    });

    const teacherAssignments = await prisma.teacherAssignment.findMany({
      where: { tenantId: tenant.id },
      include: {
        teacher: true,
        classSection: true,
        subject: true
      }
    });

    const classSubjects = await prisma.classSubject.findMany({
      where: { tenantId: tenant.id }
    });

    // Unassigned Teachers count
    const assignedTeacherIds = new Set(teacherAssignments.map(a => a.teacherId));
    const allTeachers = await prisma.staffProfile.findMany({
      where: { tenantId: tenant.id, user: { role: 'TEACHER' } },
      select: { id: true }
    });
    const unassignedTeacherCount = allTeachers.filter(t => !assignedTeacherIds.has(t.id)).length;

    // Unstaffed Subjects count
    const assignedSubjectIdsInCS = new Set(teacherAssignments.map(a => `${a.classSectionId}_${a.subjectId}`));
    const unstaffedSubjectCount = classSubjects.filter(cs => !assignedSubjectIdsInCS.has(`${cs.classSectionId}_${cs.subjectId}`)).length;

    // Duplicate Assignment check
    const seenAssignments = new Set();
    let duplicateAssignmentCount = 0;
    for (const a of teacherAssignments) {
      const key = `${a.teacherId}_${a.classSectionId}_${a.subjectId}`;
      if (seenAssignments.has(key)) {
        duplicateAssignmentCount++;
      } else {
        seenAssignments.add(key);
      }
    }

    // Cross-tenant Assignment check
    let crossTenantAssignmentCount = 0;
    for (const a of teacherAssignments) {
      if (
        (a.teacher && a.teacher.tenantId !== tenant.id) ||
        (a.classSection && a.classSection.tenantId !== tenant.id) ||
        (a.subject && a.subject.tenantId !== tenant.id)
      ) {
        crossTenantAssignmentCount++;
      }
    }

    console.log(`  Teachers: ${teacherCount}`);
    console.log(`  Class Sections: ${classSectionCount}`);
    console.log(`  Subjects: ${subjectCount}`);
    console.log(`  Teacher Assignment Count: ${teacherAssignments.length}`);
    console.log(`  Class/Section Subject Mappings: ${classSubjects.length}`);
    console.log(`  Duplicate Assignment Count: ${duplicateAssignmentCount}`);
    console.log(`  Cross-tenant Assignment Count: ${crossTenantAssignmentCount}`);
    console.log(`  Unassigned Teacher Count: ${unassignedTeacherCount}`);
    console.log(`  Unstaffed Subject Count: ${unstaffedSubjectCount}\n`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
