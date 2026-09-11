const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  const teacherAssignments = await prisma.teacherAssignment.findMany({
    where: { tenantId: TENANT_ID },
    include: {
      teacher: { include: { user: true } },
      classSection: { include: { class: true, section: true } },
      subject: true
    }
  });

  console.log('=== CURRENT TEACHER ASSIGNMENTS COUNT:', teacherAssignments.length);
  for (const ta of teacherAssignments) {
    console.log(`- Teacher: ${ta.teacher.user.name} | Subject: ${ta.subject?.name} | ClassSection: ${ta.classSection.class.name}-${ta.classSection.section.name}`);
  }

  // Also check classSection classAdvisors / teachers
  const classSections = await prisma.classSection.findMany({
    where: { tenantId: TENANT_ID },
    include: {
      class: true,
      section: true,
      teacher: { include: { user: true } }
    }
  });

  console.log('\n=== CLASS SECTIONS & CLASS ADVISORS ===');
  for (const cs of classSections) {
    console.log(`- ClassSection: ${cs.class.name}-${cs.section.name} | Advisor: ${cs.teacher ? cs.teacher.user.name : 'NONE'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
