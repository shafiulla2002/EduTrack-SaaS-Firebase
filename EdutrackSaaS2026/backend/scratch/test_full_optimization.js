const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFullOptimization() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });
  const classSectionId = sampleClassSection.id;

  console.log('--- TESTING FULL OPTIMIZATION OF getClassMatrixData ---');

  const timesCurrent = [];
  const timesOptimized = [];

  for (let i = 0; i < 5; i++) {
    // Current
    const t0_cur = performance.now();
    const periodTimings1 = await prisma.periodTiming.findMany({
      where: { tenantId, isActive: true },
      orderBy: { periodNumber: 'asc' },
    });
    const config1 = await prisma.timetableConfig.findUnique({
      where: { tenantId },
    });
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

    // Optimized
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
      // TeacherSkill with 0 nested joins (teacher names resolved in-memory via allTeachers map)
      prisma.teacherSkill.findMany({
        where: { tenantId },
      }),
    ]);

    // In-memory mapping
    const teacherNameMap = new Map(allTeachers2.map(t => [t.id, t.user?.name ?? '']));
    const allTeacherOptions = allTeachers2.map(t => ({
      Id: t.id,
      Name: t.user?.name ?? '',
      teacherId: t.id,
      teacherName: t.user?.name ?? '',
      skillLevel: 'Expert',
    }));

    const subjectTeachersMap = {};
    for (const sub of allSubjects2) {
      const skilled = teacherSkills2
        .filter(sk => sk.subjectId === sub.id)
        .map(sk => ({
          Id: sk.teacherId,
          Name: teacherNameMap.get(sk.teacherId) || '',
          teacherId: sk.teacherId,
          teacherName: teacherNameMap.get(sk.teacherId) || '',
          skillLevel: sk.skillLevel,
        }));
      subjectTeachersMap[sub.id] = skilled.length > 0 ? skilled : allTeacherOptions;
    }
    const t1_opt = performance.now();
    timesOptimized.push(t1_opt - t0_opt);
  }

  const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);

  console.log(`Current Baseline Execution:   ${avg(timesCurrent)} ms`);
  console.log(`Fully Optimized Execution:    ${avg(timesOptimized)} ms`);
  console.log(`Latency Reduction: ~${Math.round(((avg(timesCurrent) - avg(timesOptimized)) / avg(timesCurrent)) * 100)}%`);

  await prisma.$disconnect();
}

testFullOptimization().catch(console.error);
