const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, name: true, email: true, tenantId: true }
  });
  console.log('Total Teachers found:', users.length);
  for (const u of users) {
    const staff = await prisma.staffProfile.findFirst({
      where: { userId: u.id },
      select: { id: true }
    });
    if (!staff) {
      console.log('No staff profile for teacher:', u.name, u.email);
      continue;
    }
    const assign = await prisma.teacherAssignment.findMany({
      where: { teacherId: staff.id },
      include: { classSection: { include: { class: true, section: true } } }
    });
    const periods = await prisma.period.findMany({
      where: { teacherId: staff.id },
      include: { classSection: { include: { class: true, section: true } } }
    });
    const advisor = await prisma.classSection.findMany({
      where: { teacherId: staff.id },
      include: { class: true, section: true }
    });
    console.log(`\nTeacher: ${u.name} (${u.email}) [Tenant: ${u.tenantId}]`);
    console.log('  Assignments:', assign.map(a => `${a.classSection?.class?.name}-${a.classSection?.section?.name}`));
    console.log('  Periods:', periods.map(p => `${p.classSection?.class?.name}-${p.classSection?.section?.name}`));
    console.log('  Advisor:', advisor.map(cs => `${cs.class?.name}-${cs.section?.name}`));
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
