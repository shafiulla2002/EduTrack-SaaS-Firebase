const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  console.log('=== SHAFIULLA HIGH SCHOOL TEACHER ASSIGNMENTS AUDIT ===');

  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    include: {
      user: { select: { id: true, name: true, role: true } },
      classSections: { include: { class: true, section: true } },
      teacherAssignments: { include: { classSection: { include: { class: true, section: true } }, subject: true } }
    }
  });

  console.log(`Found ${staff.length} staff profiles for Shafiulla High School.`);

  for (const s of staff) {
    const advisorClasses = s.classSections.map(cs => `${cs.class.name}-${cs.section.name}`).join(', ');
    const assignedSubjects = s.teacherAssignments.map(ta => `${ta.subject?.name} (${ta.classSection.class.name}-${ta.classSection.section.name})`).join(', ');

    console.log(`- Teacher: ${s.user.name} (StaffProfileId: ${s.id}, UserId: ${s.userId})`);
    console.log(`  Advisor Classes: [${advisorClasses || 'None'}]`);
    console.log(`  Assigned Subjects & Classes: [${assignedSubjects || 'None'}]`);
    console.log(`  Subjects Taught Array: [${s.subjectsTaught.join(', ')}]`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
