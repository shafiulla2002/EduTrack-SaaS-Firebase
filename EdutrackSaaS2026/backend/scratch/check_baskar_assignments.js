const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({
      where: { name: { contains: "Baskar" } }
    });
    if (!user) {
      console.log("No user containing Baskar found.");
      return;
    }
    console.log("User:", user);

    const staff = await prisma.staffProfile.findFirst({
      where: { userId: user.id }
    });
    if (!staff) {
      console.log("No staff profile found.");
      return;
    }
    console.log("Staff Profile:", staff);

    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId: staff.id },
      include: {
        classSection: {
          include: {
            class: true,
            section: true
          }
        },
        subject: true
      }
    });

    console.log("Assignments Count:", assignments.length);
    assignments.forEach(a => {
      console.log(`- ID: ${a.id}, ClassSectionId: ${a.classSectionId}, Class: ${a.classSection.class.name}, Section: ${a.classSection.section.name}, SubjectId: ${a.subjectId}, Subject: ${a.subject.name}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
