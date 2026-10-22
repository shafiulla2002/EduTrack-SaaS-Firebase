const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const sections = await prisma.classSection.findMany({
      where: {
        tenantId: 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1'
      },
      include: {
        class: true,
        section: true
      }
    });

    console.log("Class Sections for Cambridge:");
    sections.forEach(s => {
      console.log(`- ClassSectionID: ${s.id}, Name: ${s.class.name} - ${s.section.name}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
