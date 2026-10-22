const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    console.log("Tenant:", tenant.name);

    const classes = await prisma.class.findMany({
      where: { tenantId }
    });
    console.log(`Classes (${classes.length}):`);
    for (const c of classes) {
      console.log(`- ID: ${c.id}, Name: ${c.name}`);
    }

    const classSections = await prisma.classSection.findMany({
      where: { tenantId },
      include: { class: true, section: true }
    });
    console.log(`Class Sections (${classSections.length}):`);
    for (const cs of classSections) {
      const studentsCount = await prisma.studentProfile.count({
        where: { classSectionId: cs.id }
      });
      console.log(`- ID: ${cs.id}, Name: ${cs.class.name} - ${cs.section.name}, Students: ${studentsCount}`);
    }

    const totalStudents = await prisma.studentProfile.count({
      where: { tenantId }
    });
    console.log("Total students in tenant:", totalStudents);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
