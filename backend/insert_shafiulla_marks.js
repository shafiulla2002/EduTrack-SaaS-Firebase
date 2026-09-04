const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

const EXAM_TERMS = [
  { name: 'Unit Test', date: new Date('2026-07-15') },
  { name: 'Monthly Test', date: new Date('2026-08-20') },
  { name: 'Quarterly Exam', date: new Date('2026-10-10') },
  { name: 'Half-Yearly Exam', date: new Date('2026-12-15') },
  { name: 'Pre-Final Exam', date: new Date('2027-02-10') },
  { name: 'Annual Exam', date: new Date('2027-03-25') },
];

const EXCLUDED_CLASSES = ['nursarry', 'nursery', 'lkg', 'ukg'];

function getRemark(marks) {
  if (marks >= 90) return 'Outstanding';
  if (marks >= 80) return 'Excellent';
  if (marks >= 70) return 'Very Good';
  if (marks >= 60) return 'Good';
  if (marks >= 50) return 'Satisfactory';
  if (marks >= 35) return 'Pass';
  return 'Needs Improvement';
}

// Pseudo-random deterministic noise generator per student+subject+exam to create realistic scores
function calculateMarks(studentId, subjectId, examIndex) {
  let hash = 0;
  const str = `${studentId}-${subjectId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  // Student base capability between 45 and 92
  const studentBase = 45 + (Math.abs(hash) % 48);

  // Exam noise between -7 and +7
  const examNoise = ((hash * (examIndex + 1) * 17) % 15) - 7;

  let score = studentBase + examNoise;
  if (score > 98) score = 98;
  if (score < 35) score = 35; // ensure passing baseline

  return Math.round(score);
}

async function run() {
  console.log('--- STARTING MARKS SEEDING FOR SHAFIULLA HIGH SCHOOL ---');

  // 1. Ensure all ExamTypes exist
  for (const term of EXAM_TERMS) {
    await prisma.examType.upsert({
      where: {
        name_tenantId: {
          name: term.name,
          tenantId: TENANT_ID,
        },
      },
      create: {
        name: term.name,
        tenantId: TENANT_ID,
      },
      update: {},
    });
  }
  console.log('ExamTypes verified.');

  // 2. Fetch target ClassSections (Class 1 to Class 10)
  const classSections = await prisma.classSection.findMany({
    where: { tenantId: TENANT_ID },
    include: {
      class: true,
      section: true,
      students: {
        where: { user: { isActive: true } },
        select: { id: true, rollNo: true, user: { select: { name: true } } },
      },
      classSubjects: {
        include: { subject: true },
      },
    },
  });

  const targetSections = classSections.filter(cs => {
    const classNameLower = cs.class.name.trim().toLowerCase();
    return !EXCLUDED_CLASSES.some(ex => classNameLower.includes(ex));
  });

  console.log(`Target Class Sections to process: ${targetSections.length}`);

  let totalExamsCreated = 0;
  let totalExamSubjectsCreated = 0;
  let totalMarksInserted = 0;

  for (const cs of targetSections) {
    console.log(`Processing Class: ${cs.class.name} (${cs.section.name}) - ${cs.students.length} students, ${cs.classSubjects.length} subjects...`);

    for (let examIdx = 0; examIdx < EXAM_TERMS.length; examIdx++) {
      const term = EXAM_TERMS[examIdx];

      // Find or create Exam for this classSection and exam term
      let exam = await prisma.exam.findFirst({
        where: {
          tenantId: TENANT_ID,
          classSectionId: cs.id,
          name: term.name,
        },
      });

      if (!exam) {
        exam = await prisma.exam.create({
          data: {
            name: term.name,
            type: term.name,
            classSectionId: cs.id,
            date: term.date,
            tenantId: TENANT_ID,
          },
        });
        totalExamsCreated++;
      }

      // Ensure ExamSubjects exist for all subjects in this classSection
      const examSubjectData = cs.classSubjects.map(csSub => ({
        examId: exam.id,
        subjectId: csSub.subjectId,
        subjectType: 'Theory',
        maxMarks: 100,
        passMarks: 35,
        passingPercentage: 35,
        tenantId: TENANT_ID,
      }));

      await prisma.examSubject.createMany({
        data: examSubjectData,
        skipDuplicates: true,
      });

      totalExamSubjectsCreated += examSubjectData.length;

      // Build ExamMark records for all students x subjects
      const markRecords = [];
      for (const student of cs.students) {
        for (const csSub of cs.classSubjects) {
          const score = calculateMarks(student.id, csSub.subjectId, examIdx);
          markRecords.push({
            examId: exam.id,
            studentId: student.id,
            subjectId: csSub.subjectId,
            subjectType: 'Theory',
            marksObtained: score,
            remarks: getRemark(score),
            tenantId: TENANT_ID,
          });
        }
      }

      if (markRecords.length > 0) {
        // Chunk batch insert to prevent parameter limit issues in postgres
        const CHUNK_SIZE = 2000;
        for (let i = 0; i < markRecords.length; i += CHUNK_SIZE) {
          const chunk = markRecords.slice(i, i + CHUNK_SIZE);
          await prisma.examMark.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        }
        totalMarksInserted += markRecords.length;
      }
    }
  }

  console.log('==================================================');
  console.log('SUCCESSFULLY INSERTED MARKS FOR SHAFIULLA HIGH SCHOOL!');
  console.log(`Exams Created: ${totalExamsCreated}`);
  console.log(`Exam Subjects Created: ${totalExamSubjectsCreated}`);
  console.log(`Total Student Marks Inserted: ${totalMarksInserted}`);
  console.log('==================================================');
}

run()
  .catch(e => console.error('Error inserting marks:', e))
  .finally(() => prisma.$disconnect());
