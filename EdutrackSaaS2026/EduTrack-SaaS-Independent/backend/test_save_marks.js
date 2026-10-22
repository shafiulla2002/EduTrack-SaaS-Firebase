const { PrismaClient, Prisma } = require('./node_modules/@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

async function test() {
  try {
    const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Shafiulla High School
    const exam = await prisma.exam.findFirst({ where: { tenantId } });
    const classSection = await prisma.classSection.findFirst({ where: { tenantId } });
    const subject = await prisma.subject.findFirst({ where: { tenantId } });
    const student = await prisma.studentProfile.findFirst({ where: { tenantId } });

    console.log('Exam:', exam?.id, 'Student:', student?.id, 'Subject:', subject?.id);

    if (exam && student && subject) {
      const values = [
        Prisma.sql`(${randomUUID()}, ${exam.id}, ${student.id}, ${subject.id}, 'Theory', 85.5, 'Good', ${tenantId})`
      ];

      const res = await prisma.$executeRaw`
        INSERT INTO "ExamMark" ("id", "examId", "studentId", "subjectId", "subjectType", "marksObtained", "remarks", "tenantId")
        VALUES ${Prisma.join(values, ', ')}
        ON CONFLICT ("examId", "studentId", "subjectId", "subjectType")
        DO UPDATE SET 
          "marksObtained" = EXCLUDED."marksObtained",
          "remarks" = EXCLUDED."remarks";
      `;
      console.log('Bulk Upsert Result:', res);
    }
  } catch (err) {
    console.error('Test Failed With Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
