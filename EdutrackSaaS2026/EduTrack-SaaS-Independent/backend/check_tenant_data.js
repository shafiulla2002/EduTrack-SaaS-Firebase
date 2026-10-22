const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '778b7f12-d8c3-406d-926c-a403b46100ef';
  const sections = await prisma.classSection.findMany({
    where: { tenantId },
    include: { class: true, section: true }
  });
  console.log("SECTIONS IN DB:", sections.map(s => ({ id: s.id, className: s.class.name, sectionName: s.section.name })));
  await prisma.$disconnect();
}

main();
