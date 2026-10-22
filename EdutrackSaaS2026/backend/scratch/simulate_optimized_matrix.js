const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runOptimizedSimulation() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });
  const classSectionId = sampleClassSection.id;

  console.log('--- SIMULATING OPTIMIZED getClassMatrixData ---');

  const timesCurrent = [];
  const timesOptimized = [];

  for (let i = 0; i < 5; i++) {
    // ── 1. CURRENT IMPLEMENTATION ──
    const t0_cur = performance.now();

    // Sequential Q1 & Q2
    const periodTimings1 = await prisma.periodTiming.findMany({
      where: { tenantId, isActive: true },
      orderBy: { periodNumber: 'asc' },
    });
    const config1 = await prisma.timetableConfig.findUnique({
      where: { tenantId },
    });

    // Concurrent Q3-Q7 with unused teacherAssigns joins
    const [classSection1, periods1, allSubjects1, allTeachers1, teacherSkills1] = await Promise.all([
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
      }),
      prisma.period.findMany({
        where: { classSectionId, tenantId },
        include: {
          subject: true,
          teacher: { include: { user: true } },
          substituteTeacher: { include: { user: true } },
          periodTiming: true,
        },
      }),
      prisma.subject.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
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
      }),
      prisma.teacherSkill.findMany({
        where: { tenantId },
        include: { teacher: { include: { user: true } } },
      }),
    ]);
    const t1_cur = performance.now();
    timesCurrent.push(t1_cur - t0_cur);

    // ── 2. OPTIMIZED IMPLEMENTATION ──
    // All queries executed concurrently in a SINGLE Promise.all batch
    // AND removing unused teacherAssigns relation loading from classSection
    const t0_opt = performance.now();
    const [
      periodTimings2,
      config2,
      classSection2,
      periods2,
      allSubjects2,
      allTeachers2,
      teacherSkills2
    ] = await Promise.all([
      prisma.periodTiming.findMany({
        where: { tenantId, isActive: true },
        orderBy: { periodNumber: 'asc' },
      }),
      prisma.timetableConfig.findUnique({
        where: { tenantId },
      }),
      prisma.classSection.findUnique({
        where: { id: classSectionId },
        include: {
          class: true,
          section: true,
          classSubjects: {
            include: { subject: true },
            orderBy: { subject: { name: 'asc' } },
          },
        },
      }),
      prisma.period.findMany({
        where: { classSectionId, tenantId },
        include: {
          subject: true,
          teacher: { include: { user: true } },
          substituteTeacher: { include: { user: true } },
          periodTiming: true,
        },
      }),
      prisma.subject.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
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
      }),
      prisma.teacherSkill.findMany({
        where: { tenantId },
        include: { teacher: { include: { user: true } } },
      }),
    ]);
    const t1_opt = performance.now();
    timesOptimized.push(t1_opt - t0_opt);
  }

  const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);

  console.log(`Current Architecture Average Duration:   ${avg(timesCurrent)} ms`);
  console.log(`Optimized Architecture Average Duration: ${avg(timesOptimized)} ms`);
  console.log(`Measured Speedup: ~${Math.round(((avg(timesCurrent) - avg(timesOptimized)) / avg(timesCurrent)) * 100)}% latency reduction`);

  await prisma.$disconnect();
}

runOptimizedSimulation().catch(console.error);
