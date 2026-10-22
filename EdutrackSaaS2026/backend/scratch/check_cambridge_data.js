const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenantId = "ebc2dcb0-8985-43a7-bc83-c62b22f301d1";
    const sectionA = "14ad1cec-286d-4a88-816e-2ee2adc27728";
    const sectionB = "0f5e1252-3dfc-40d9-81af-70a99f0ef488";

    // Count students in Section A
    const countA = await prisma.studentProfile.count({
      where: { classSectionId: sectionA }
    });
    console.log("Students in Section A:", countA);

    // Count students in Section B
    const countB = await prisma.studentProfile.count({
      where: { classSectionId: sectionB }
    });
    console.log("Students in Section B:", countB);

    // Get all ClassSections and strength
    const allSections = await prisma.classSection.findMany({
      where: { tenantId },
      include: {
        class: true,
        section: true,
        _count: {
          select: { students: true }
        }
      }
    });
    console.log("Class Sections List:");
    allSections.forEach(cs => {
      console.log(`- ClassSectionId: ${cs.id}, Class: ${cs.class.name}, Section: ${cs.section.name}, Strength Field: ${cs.strength}, Actual Students Count: ${cs._count.students}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
