const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function traceIndividualQueries() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });
  const classSectionId = sampleClassSection.id;

  console.log('--- DETAILED SINGLE QUERY BREAKDOWN (10 runs) ---');

  const runN = async (name, fn, n = 5) => {
    const times = [];
    let lastRes;
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      lastRes = await fn();
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2);
    const min = Math.min(...times).toFixed(2);
    const max = Math.max(...times).toFixed(2);
    console.log(`${name.padEnd(45)} | Avg: ${avg.padStart(7)} ms | Min: ${min.padStart(7)} ms | Max: ${max.padStart(7)} ms`);
    return lastRes;
  };

  await runN('1. PeriodTiming.findMany (tenantId)', () =>
    prisma.periodTiming.findMany({
      where: { tenantId, isActive: true },
      orderBy: { periodNumber: 'asc' },
    })
  );

  await runN('2. TimetableConfig.findUnique (tenantId)', () =>
    prisma.timetableConfig.findUnique({
      where: { tenantId },
    })
  );

  await runN('3. ClassSection.findUnique (id + joins)', () =>
    prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: {
        class: true,
        section: true,
        classSubjects: {
          include: { subject: true },
          orderBy: { subject: { name: 'asc' } },
        },
        teacherAssigns: {
          include: { teacher: { include: { user: true } }, subject: true },
        },
      },
    })
  );

  await runN('4. Period.findMany (classSectionId + tenantId)', () =>
    prisma.period.findMany({
      where: { classSectionId, tenantId },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        substituteTeacher: { include: { user: true } },
        periodTiming: true,
      },
    })
  );

  await runN('5. Subject.findMany (tenantId)', () =>
    prisma.subject.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    })
  );

  await runN('6. StaffProfile.findMany (tenantId + OR)', () =>
    prisma.staffProfile.findMany({
      where: {
        tenantId,
        OR: [
          { user: { role: 'TEACHER' } },
          { designation: { contains: 'Teacher', mode: 'insensitive' } },
          { teacherSkills: { some: {} } },
        ],
      },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    })
  );

  await runN('7. TeacherSkill.findMany (tenantId + joins)', () =>
    prisma.teacherSkill.findMany({
      where: { tenantId },
      include: { teacher: { include: { user: true } } },
    })
  );

  await prisma.$disconnect();
}

traceIndividualQueries().catch(console.error);
