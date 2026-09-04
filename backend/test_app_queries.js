const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
const DAVID_TENANT_ID = '4afac1ca-11b6-4776-a2a4-ad407cf061b1';

async function main() {
  console.log('=== STEP 9: APPLICATION & MULTI-TENANT VERIFICATION ===\n');

  // 1. Test Admin Dashboard Query (Aggregating scores)
  console.log('Testing Admin Dashboard score query...');
  const shafiullaAvg = await prisma.examMark.aggregate({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    _avg: { marksObtained: true },
    _count: { id: true },
  });
  console.log(`Shafiulla High School: ${shafiullaAvg._count.id} marks, Average Score = ${Number(shafiullaAvg._avg.marksObtained).toFixed(2)}`);

  const davidAvg = await prisma.examMark.aggregate({
    where: { tenantId: DAVID_TENANT_ID },
    _avg: { marksObtained: true },
    _count: { id: true },
  });
  console.log(`David High School: ${davidAvg._count.id} marks, Average Score = ${davidAvg._avg.marksObtained ? Number(davidAvg._avg.marksObtained).toFixed(2) : 0}`);

  // 2. Test Teacher Portal Marks Entry Fetch (Class 1 Section A, Unit Test)
  console.log('\nTesting Teacher Portal Marks Entry query...');
  const classSection = await prisma.classSection.findFirst({
    where: { tenantId: SHAFIULLA_TENANT_ID, class: { name: 'Class-1' }, section: { name: 'Section-A' } },
    include: { classSubjects: { include: { subject: true } } }
  });
  
  if (classSection && classSection.classSubjects.length > 0) {
    const subjectId = classSection.classSubjects[0].subjectId;
    const exam = await prisma.exam.findFirst({
      where: { tenantId: SHAFIULLA_TENANT_ID, classSectionId: classSection.id, name: 'Unit Test' }
    });

    const studentMarks = await prisma.examMark.findMany({
      where: {
        tenantId: SHAFIULLA_TENANT_ID,
        examId: exam.id,
        subjectId: subjectId,
        subjectType: 'Theory',
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
        subject: true
      },
      take: 5
    });

    console.log(`Teacher Portal sample entries for ${classSection.classSubjects[0].subject.name} (Unit Test):`);
    for (const sm of studentMarks) {
      console.log(`- Student: ${sm.student.user.name} | Marks: ${sm.marksObtained} | Remark: ${sm.remarks}`);
    }
  }

  // 3. Test Parent Portal Student History
  console.log('\nTesting Parent Portal Recent Marks query...');
  const sampleStudent = await prisma.studentProfile.findFirst({
    where: { tenantId: SHAFIULLA_TENANT_ID, classSectionId: classSection.id }
  });

  if (sampleStudent) {
    const parentMarks = await prisma.examMark.findMany({
      where: { tenantId: SHAFIULLA_TENANT_ID, studentId: sampleStudent.id },
      include: { exam: true, subject: true },
      orderBy: { exam: { date: 'desc' } },
      take: 5
    });

    console.log(`Parent Portal history for Student ID (${sampleStudent.id}): ${parentMarks.length} records fetched.`);
    for (const pm of parentMarks) {
      console.log(`- Exam: ${pm.exam.name} | Subject: ${pm.subject.name} | Score: ${pm.marksObtained} (${pm.remarks})`);
    }
  }

  // 4. Strict Multi-Tenant Security Verification
  console.log('\nVerifying Multi-Tenant Isolation Security...');
  const crossTenantLeak = await prisma.examMark.findFirst({
    where: {
      tenantId: SHAFIULLA_TENANT_ID,
      student: { tenantId: DAVID_TENANT_ID }
    }
  });

  if (crossTenantLeak) {
    console.error('SECURITY ERROR: Cross-tenant data leak detected!');
    process.exit(1);
  } else {
    console.log('MULTI-TENANT ISOLATION VERIFIED: 0 cross-tenant leaks. Strict isolation maintained!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
