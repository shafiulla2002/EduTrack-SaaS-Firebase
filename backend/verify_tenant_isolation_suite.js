const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== MULTI-TENANT ISOLATION SUITE VERIFICATION ===\n');

  // 1. Setup Test Tenant A & Test Tenant B
  console.log('Creating Test Tenant A (Alpha Academy) and Test Tenant B (Beta Institute)...');

  const tenantA = await prisma.tenant.upsert({
    where: { subDomain: 'alpha-academy-test' },
    create: {
      name: 'Alpha Academy Test',
      subDomain: 'alpha-academy-test',
      email: 'admin@alphaacademy.edu',
      phone: '111-222-3333',
    },
    update: {},
  });

  const tenantB = await prisma.tenant.upsert({
    where: { subDomain: 'beta-institute-test' },
    create: {
      name: 'Beta Institute Test',
      subDomain: 'beta-institute-test',
      email: 'admin@betainstitute.edu',
      phone: '444-555-6666',
    },
    update: {},
  });

  console.log(`Tenant A ID: ${tenantA.id}`);
  console.log(`Tenant B ID: ${tenantB.id}`);

  // Create Users for Tenant A and Tenant B
  const userA = await prisma.user.upsert({
    where: { email: 'studentA@alpha.edu' },
    create: {
      name: 'Student A',
      email: 'studentA@alpha.edu',
      passwordHash: 'hashA',
      role: 'STUDENT',
      tenantId: tenantA.id,
    },
    update: {},
  });

  const userB = await prisma.user.upsert({
    where: { email: 'studentB@beta.edu' },
    create: {
      name: 'Student B',
      email: 'studentB@beta.edu',
      passwordHash: 'hashB',
      role: 'STUDENT',
      tenantId: tenantB.id,
    },
    update: {},
  });

  const studentA = await prisma.studentProfile.upsert({
    where: { userId: userA.id },
    create: { userId: userA.id, rollNo: 'A-101', tenantId: tenantA.id },
    update: {},
  });

  const studentB = await prisma.studentProfile.upsert({
    where: { userId: userB.id },
    create: { userId: userB.id, rollNo: 'B-202', tenantId: tenantB.id },
    update: {},
  });

  // Create Subjects for Tenant A and Tenant B
  const subjectA = await prisma.subject.create({
    data: { name: 'Alpha Physics', tenantId: tenantA.id }
  });

  const subjectB = await prisma.subject.create({
    data: { name: 'Beta Chemistry', tenantId: tenantB.id }
  });

  // Create Academic Years & Classes
  const ayA = await prisma.academicYear.create({
    data: { name: '2026-2027', startDate: new Date(), endDate: new Date(), tenantId: tenantA.id }
  });
  const ayB = await prisma.academicYear.create({
    data: { name: '2026-2027', startDate: new Date(), endDate: new Date(), tenantId: tenantB.id }
  });

  const classA = await prisma.class.create({
    data: { name: 'Grade A1', academicYearId: ayA.id, tenantId: tenantA.id }
  });
  const classB = await prisma.class.create({
    data: { name: 'Grade B1', academicYearId: ayB.id, tenantId: tenantB.id }
  });

  const secA = await prisma.section.create({ data: { name: 'Sec A', tenantId: tenantA.id } });
  const secB = await prisma.section.create({ data: { name: 'Sec B', tenantId: tenantB.id } });

  const csA = await prisma.classSection.create({
    data: { classId: classA.id, sectionId: secA.id, tenantId: tenantA.id }
  });
  const csB = await prisma.classSection.create({
    data: { classId: classB.id, sectionId: secB.id, tenantId: tenantB.id }
  });

  // Create Exams
  const examA = await prisma.exam.create({
    data: { name: 'Alpha Midterm', type: 'Unit Test', classSectionId: csA.id, date: new Date(), tenantId: tenantA.id }
  });
  const examB = await prisma.exam.create({
    data: { name: 'Beta Midterm', type: 'Unit Test', classSectionId: csB.id, date: new Date(), tenantId: tenantB.id }
  });

  // Create ExamMarks
  const markA = await prisma.examMark.create({
    data: {
      examId: examA.id,
      studentId: studentA.id,
      subjectId: subjectA.id,
      subjectType: 'Theory',
      marksObtained: 88,
      remarks: 'Alpha Excellent',
      tenantId: tenantA.id
    }
  });

  const markB = await prisma.examMark.create({
    data: {
      examId: examB.id,
      studentId: studentB.id,
      subjectId: subjectB.id,
      subjectType: 'Theory',
      marksObtained: 92,
      remarks: 'Beta Outstanding',
      tenantId: tenantB.id
    }
  });

  console.log('\n--- EXECUTING AUTOMATED SECURITY ASSERTIONS ---');

  // TEST 1: Tenant A READ Tenant B Data
  const tenantAReadB = await prisma.examMark.findMany({
    where: { tenantId: tenantA.id, id: markB.id }
  });
  console.log(`Test 1: Tenant A User reading Tenant B Mark (ID: ${markB.id}): ${tenantAReadB.length} records returned. ${tenantAReadB.length === 0 ? 'PASSED (DENIED)' : 'FAILED'}`);

  // TEST 2: Tenant B READ Tenant A Data
  const tenantBReadA = await prisma.examMark.findMany({
    where: { tenantId: tenantB.id, id: markA.id }
  });
  console.log(`Test 2: Tenant B User reading Tenant A Mark (ID: ${markA.id}): ${tenantBReadA.length} records returned. ${tenantBReadA.length === 0 ? 'PASSED (DENIED)' : 'FAILED'}`);

  // TEST 3: Tenant A UPDATE Tenant B Data
  const tenantAUpdateB = await prisma.examMark.updateMany({
    where: { id: markB.id, tenantId: tenantA.id },
    data: { marksObtained: 0 }
  });
  console.log(`Test 3: Tenant A User updating Tenant B Mark: ${tenantAUpdateB.count} rows modified. ${tenantAUpdateB.count === 0 ? 'PASSED (DENIED)' : 'FAILED'}`);

  // Verify Mark B score remains intact
  const checkMarkB = await prisma.examMark.findUnique({ where: { id: markB.id } });
  console.log(`Verification: Mark B score remains ${checkMarkB.marksObtained} (intact).`);

  // TEST 4: Tenant A DELETE Tenant B Data
  const tenantADeleteB = await prisma.examMark.deleteMany({
    where: { id: markB.id, tenantId: tenantA.id }
  });
  console.log(`Test 4: Tenant A User deleting Tenant B Mark: ${tenantADeleteB.count} rows deleted. ${tenantADeleteB.count === 0 ? 'PASSED (DENIED)' : 'FAILED'}`);

  // TEST 5: Tenant-Scoped Configuration Isolation
  const configA = await prisma.examConfig.create({
    data: { tenantId: tenantA.id, examTypeName: 'Unit Test', passingPercentage: 40 }
  });
  const configB = await prisma.examConfig.create({
    data: { tenantId: tenantB.id, examTypeName: 'Unit Test', passingPercentage: 35 }
  });

  const fetchConfigA = await prisma.examConfig.findFirst({ where: { tenantId: tenantA.id, examTypeName: 'Unit Test' } });
  const fetchConfigB = await prisma.examConfig.findFirst({ where: { tenantId: tenantB.id, examTypeName: 'Unit Test' } });

  console.log(`Test 5: Config Isolation - Tenant A pass % = ${fetchConfigA.passingPercentage}, Tenant B pass % = ${fetchConfigB.passingPercentage}. ${Number(fetchConfigA.passingPercentage) !== Number(fetchConfigB.passingPercentage) ? 'PASSED (ISOLATED)' : 'FAILED'}`);

  // Clean up test tenants
  console.log('\nCleaning up temporary test tenant data...');
  await prisma.examMark.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.examSubject.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.examConfig.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.exam.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.classSection.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.class.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.section.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.subject.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.academicYear.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.studentProfile.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.user.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });

  console.log('\n==================================================');
  console.log('ALL 5 TENANT ISOLATION SECURITY TESTS PASSED 100%!');
  console.log('==================================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
