const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function measureAverages() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });
  const classSectionId = sampleClassSection.id;

  console.log('Running 5 benchmark iterations for getClassMatrixData...');

  const results = {
    q1_periodTiming: [],
    q2_config: [],
    q3_classSection: [],
    q4_periods: [],
    q5_subjects: [],
    q6_teachers: [],
    q7_skills: [],
    promiseAll: [],
    nodeTransform: [],
    totalTime: []
  };

  for (let i = 0; i < 5; i++) {
    const t0_all = performance.now();

    // Q1
    const t0_1 = performance.now();
    const periodTimings = await prisma.periodTiming.findMany({
      where: { tenantId, isActive: true },
      orderBy: { periodNumber: 'asc' },
    });
    const t1_1 = performance.now();
    results.q1_periodTiming.push(t1_1 - t0_1);

    // Q2
    const t0_2 = performance.now();
    const config = await prisma.timetableConfig.findUnique({
      where: { tenantId },
    });
    const t1_2 = performance.now();
    results.q2_config.push(t1_2 - t0_2);

    // Q3-Q7 concurrent
    const t0_pAll = performance.now();
    const [classSection, periods, allSubjects, allTeachers, teacherSkills] = await Promise.all([
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
    const t1_pAll = performance.now();
    results.promiseAll.push(t1_pAll - t0_pAll);

    // Node.js map transform
    const t0_n = performance.now();
    const classSubjectsList = (classSection?.classSubjects || []).map(cs => ({
      subjectId: cs.subjectId,
      subjectName: cs.subject?.name ?? '',
    }));

    const allTeacherOptions = allTeachers.map(t => ({
      Id: t.id,
      Name: t.user?.name ?? '',
      teacherId: t.id,
      teacherName: t.user?.name ?? '',
      skillLevel: 'Expert',
    }));

    const subjectTeachersMap = {};
    for (const sub of allSubjects) {
      const skilled = teacherSkills
        .filter(sk => sk.subjectId === sub.id)
        .map(sk => ({
          Id: sk.teacherId,
          Name: sk.teacher?.user?.name ?? '',
          teacherId: sk.teacherId,
          teacherName: sk.teacher?.user?.name ?? '',
          skillLevel: sk.skillLevel,
        }));
      subjectTeachersMap[sub.id] = skilled.length > 0 ? skilled : allTeacherOptions;
    }

    const timingIdToNum = new Map(periodTimings.map(pt => [pt.id, pt.periodNumber]));
    const mappedPeriods = periods.map(p => {
      const pNum = p.periodTiming?.periodNumber ?? timingIdToNum.get(p.periodTimingId) ?? 0;
      return {
        periodId: p.id,
        day: p.dayOfWeek,
        periodNumber: pNum,
        subjectId: p.subjectId,
        subjectName: p.subject?.name ?? '—',
        teacherId: p.teacherId,
        teacherName: p.teacher?.user?.name ?? 'Unassigned',
        classSectionId: p.classSectionId ?? '',
        academicYearId: '',
        startTime: p.periodTiming?.startTime ?? '',
        endTime: p.periodTiming?.endTime ?? '',
        frequency: 'Weekly',
        isSubstitute: !!p.substituteTeacherId,
        substituteTeacherId: p.substituteTeacherId ?? null,
        substituteTeacherName: p.substituteTeacher?.user?.name ?? null,
        originalTeacherName: p.teacher?.user?.name ?? null,
      };
    });
    const t1_n = performance.now();
    results.nodeTransform.push(t1_n - t0_n);

    const t1_all = performance.now();
    results.totalTime.push(t1_all - t0_all);
  }

  const avg = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);

  console.log('\n--- AVERAGE TIMINGS (Over 5 iterations) ---');
  console.log(`Q1: PeriodTiming findMany: ${avg(results.q1_periodTiming)} ms`);
  console.log(`Q2: TimetableConfig findUnique: ${avg(results.q2_config)} ms`);
  console.log(`Q3-Q7: Concurrent Promise.all: ${avg(results.promiseAll)} ms`);
  console.log(`Node.js In-Memory Mapping: ${avg(results.nodeTransform)} ms`);
  console.log(`Total End-to-End Execution: ${avg(results.totalTime)} ms`);

  await prisma.$disconnect();
}

measureAverages().catch(console.error);
