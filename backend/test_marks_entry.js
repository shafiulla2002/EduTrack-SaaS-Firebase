const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function testMarksEntry() {
  try {
    const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Shafiulla High School
    const classSection = await prisma.classSection.findFirst({ where: { tenantId } });
    const subject = await prisma.subject.findFirst({ where: { tenantId } });

    console.log('Testing getStudentsForMarksEntry with classSection:', classSection?.id, 'subject:', subject?.id);

    if (classSection && subject) {
      // Find or check exam
      const examName = 'Unit Test';
      const exam = await prisma.exam.findFirst({
        where: {
          tenantId,
          classSectionId: classSection.id,
          name: examName,
        }
      });
      console.log('Found Exam:', exam?.id);

      // Check students query
      const students = await prisma.studentProfile.findMany({
        where: {
          classSectionId: classSection.id,
          user: { tenantId, isActive: true }
        },
        include: {
          user: { select: { name: true } }
        },
        orderBy: { user: { name: 'asc' } }
      });
      console.log('Students Found:', students.length);

      // Check exam config
      const examConfig = await prisma.examConfig.findFirst({
        where: { tenantId }
      });
      console.log('ExamConfig Found:', examConfig?.id);
    }
  } catch (err) {
    console.error('Test Failed With Exception:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testMarksEntry();
