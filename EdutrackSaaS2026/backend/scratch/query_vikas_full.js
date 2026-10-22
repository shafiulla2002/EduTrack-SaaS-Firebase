const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const teacherId = "5a6c5d7d-0932-449a-ba6a-ef6ddad8570c";
    
    // 1. Get assignments
    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId },
      include: {
        classSection: {
          include: {
            class: true,
            section: true
          }
        },
        subject: true,
        tenant: true
      }
    });
    console.log("=== Assignments ===");
    console.log(JSON.stringify(assignments, null, 2));

    // 2. Get periods
    const periods = await prisma.period.findMany({
      where: { teacherId },
      include: {
        classSection: {
          include: {
            class: true,
            section: true
          }
        },
        subject: true,
        periodTiming: true
      }
    });
    console.log("=== Periods ===");
    console.log(JSON.stringify(periods, null, 2));

    // 3. Get homeworks
    const homeworks = await prisma.homework.findMany({
      where: { teacherId }
    });
    console.log("=== Homeworks ===");
    console.log(JSON.stringify(homeworks, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
