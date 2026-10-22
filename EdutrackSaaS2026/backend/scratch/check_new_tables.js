const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenantId = "ebc2dcb0-8985-43a7-bc83-c62b22f301d1";
    
    // 1. Total student profiles
    const studentCount = await prisma.studentProfile.count({ where: { tenantId } });
    console.log("Total Student Profiles in Tenant:", studentCount);

    // 2. Sample students
    const sampleStudents = await prisma.studentProfile.findMany({
      where: { tenantId },
      take: 2,
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true
          }
        }
      }
    });
    console.log("Sample Students:");
    sampleStudents.forEach(s => {
      console.log(`- Name: ${s.user.name}, ClassSectionId: ${s.classSectionId}, ClassSection: ${s.classSection ? s.classSection.class.name + " " + s.classSection.section.name : 'None'}`);
    });

    // 3. Total periods in tenant
    const periodCount = await prisma.period.count({ where: { tenantId } });
    console.log("Total Periods in Tenant:", periodCount);

    // 4. Sample periods
    const samplePeriods = await prisma.period.findMany({
      where: { tenantId },
      take: 5,
      include: {
        teacher: { include: { user: true } },
        classSection: { include: { class: true, section: true } },
        subject: true
      }
    });
    console.log("Sample Periods:");
    samplePeriods.forEach(p => {
      console.log(`- Day: ${p.dayOfWeek}, Class: ${p.classSection.class.name} ${p.classSection.section.name}, Subject: ${p.subject.name}, Teacher: ${p.teacher.user.name} (${p.teacherId})`);
    });

    // 5. Total homeworks
    const hwCount = await prisma.homework.count({ where: { tenantId } });
    console.log("Total Homeworks in Tenant:", hwCount);

    // 6. Total exams
    const examCount = await prisma.exam.count({ where: { tenantId } });
    console.log("Total Exams in Tenant:", examCount);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
