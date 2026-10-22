const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runParityTest() {
  console.log('===============================================================');
  console.log('  PHASE 5: STRICT JSON PARITY TEST FOR getClassMatrixData      ');
  console.log('===============================================================');

  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });
  const classSectionId = sampleClassSection.id;
  const sampleYear = await prisma.academicYear.findFirst({ where: { tenantId } });
  const academicYearId = sampleYear ? sampleYear.id : '';

  // 1. BASELINE IMPLEMENTATION
  let periodTimings1 = await prisma.periodTiming.findMany({
    where: { tenantId, isActive: true },
    orderBy: { periodNumber: 'asc' },
  });
  let config1 = await prisma.timetableConfig.findUnique({
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

  const classSubjectsList1 = (classSection1?.classSubjects || []).map(cs => ({
    subjectId: cs.subjectId,
    subjectName: cs.subject?.name ?? '',
  }));

  const allTeacherOptions1 = allTeachers1.map(t => ({
    Id: t.id,
    Name: t.user?.name ?? '',
    teacherId: t.id,
    teacherName: t.user?.name ?? '',
    skillLevel: 'Expert',
  }));

  const subjectTeachersMap1 = {};
  for (const sub of allSubjects1) {
    const skilled = teacherSkills1
      .filter(sk => sk.subjectId === sub.id)
      .map(sk => ({
        Id: sk.teacherId,
        Name: sk.teacher?.user?.name ?? '',
        teacherId: sk.teacherId,
        teacherName: sk.teacher?.user?.name ?? '',
        skillLevel: sk.skillLevel,
      }));
    subjectTeachersMap1[sub.id] = skilled.length > 0 ? skilled : allTeacherOptions1;
  }

  const timingIdToNum1 = new Map(periodTimings1.map(pt => [pt.id, pt.periodNumber]));
  const mappedPeriods1 = periods1.map(p => {
    const pNum = p.periodTiming?.periodNumber ?? timingIdToNum1.get(p.periodTimingId) ?? 0;
    return {
      periodId: p.id,
      day: p.dayOfWeek,
      periodNumber: pNum,
      subjectId: p.subjectId,
      subjectName: p.subject?.name ?? '—',
      teacherId: p.teacherId,
      teacherName: p.teacher?.user?.name ?? 'Unassigned',
      classSectionId: p.classSectionId ?? '',
      academicYearId: academicYearId || '',
      startTime: p.periodTiming?.startTime ?? '',
      endTime: p.periodTiming?.endTime ?? '',
      frequency: 'Weekly',
      isSubstitute: !!p.substituteTeacherId,
      substituteTeacherId: p.substituteTeacherId ?? null,
      substituteTeacherName: p.substituteTeacher?.user?.name ?? null,
      originalTeacherName: p.teacher?.user?.name ?? null,
    };
  });

  const baselinePayload = {
    classSection: classSection1
      ? {
          id: classSection1.id,
          name: `${classSection1.class?.name || 'Class'} - ${classSection1.section?.name || 'Section'}`,
          classId: classSection1.classId,
          sectionId: classSection1.sectionId,
          strength: classSection1.strength,
        }
      : null,
    classSubjects: classSubjectsList1,
    allSubjects: allSubjects1.map(s => ({ id: s.id, name: s.name })),
    periodTimings: periodTimings1,
    config: config1,
    periods: mappedPeriods1,
    subjectTeachers: subjectTeachersMap1,
    allTeachers: allTeacherOptions1,
  };

  // 2. OPTIMIZED IMPLEMENTATION
  let [
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
    }),
  ]);

  if (periodTimings2.length === 0) {
    const defaultTimings = [
      { periodNumber: 1, name: 'P1', startTime: '09:00 AM', endTime: '10:00 AM', isBreak: false, isActive: true, tenantId },
      { periodNumber: 2, name: 'P2', startTime: '10:00 AM', endTime: '11:00 AM', isBreak: false, isActive: true, tenantId },
      { periodNumber: 3, name: 'P3', startTime: '11:00 AM', endTime: '12:00 PM', isBreak: false, isActive: true, tenantId },
      { periodNumber: 4, name: 'P4', startTime: '12:00 PM', endTime: '01:00 PM', isBreak: false, isActive: true, tenantId },
      { periodNumber: 5, name: 'P5', startTime: '01:00 PM', endTime: '02:00 PM', isBreak: false, isActive: true, tenantId },
      { periodNumber: 6, name: 'P6', startTime: '02:00 PM', endTime: '03:00 PM', isBreak: false, isActive: true, tenantId },
      { periodNumber: 7, name: 'P7', startTime: '03:00 PM', endTime: '04:00 PM', isBreak: false, isActive: true, tenantId },
      { periodNumber: 8, name: 'P8', startTime: '04:00 PM', endTime: '05:00 PM', isBreak: false, isActive: true, tenantId },
    ];
    await prisma.periodTiming.createMany({ data: defaultTimings });
    periodTimings2 = await prisma.periodTiming.findMany({
      where: { tenantId, isActive: true },
      orderBy: { periodNumber: 'asc' },
    });
  }

  if (!config2) {
    config2 = await prisma.timetableConfig.create({
      data: {
        tenantId,
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        schoolStartTime: '09:00 AM',
        schoolEndTime: '04:00 PM',
        periodDuration: 45,
        autoGenerate: false,
        numPeriods: 8,
      },
    });
  }

  const classSubjectsList2 = (classSection2?.classSubjects || []).map(cs => ({
    subjectId: cs.subjectId,
    subjectName: cs.subject?.name ?? '',
  }));

  const teacherNameMap = new Map(allTeachers2.map(t => [t.id, t.user?.name ?? '']));
  const allTeacherOptions2 = allTeachers2.map(t => ({
    Id: t.id,
    Name: t.user?.name ?? '',
    teacherId: t.id,
    teacherName: t.user?.name ?? '',
    skillLevel: 'Expert',
  }));

  const subjectTeachersMap2 = {};
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
    subjectTeachersMap2[sub.id] = skilled.length > 0 ? skilled : allTeacherOptions2;
  }

  const timingIdToNum2 = new Map(periodTimings2.map(pt => [pt.id, pt.periodNumber]));
  const mappedPeriods2 = periods2.map(p => {
    const pNum = p.periodTiming?.periodNumber ?? timingIdToNum2.get(p.periodTimingId) ?? 0;
    return {
      periodId: p.id,
      day: p.dayOfWeek,
      periodNumber: pNum,
      subjectId: p.subjectId,
      subjectName: p.subject?.name ?? '—',
      teacherId: p.teacherId,
      teacherName: p.teacher?.user?.name ?? 'Unassigned',
      classSectionId: p.classSectionId ?? '',
      academicYearId: academicYearId || '',
      startTime: p.periodTiming?.startTime ?? '',
      endTime: p.periodTiming?.endTime ?? '',
      frequency: 'Weekly',
      isSubstitute: !!p.substituteTeacherId,
      substituteTeacherId: p.substituteTeacherId ?? null,
      substituteTeacherName: p.substituteTeacher?.user?.name ?? null,
      originalTeacherName: p.teacher?.user?.name ?? null,
    };
  });

  const optimizedPayload = {
    classSection: classSection2
      ? {
          id: classSection2.id,
          name: `${classSection2.class?.name || 'Class'} - ${classSection2.section?.name || 'Section'}`,
          classId: classSection2.classId,
          sectionId: classSection2.sectionId,
          strength: classSection2.strength,
        }
      : null,
    classSubjects: classSubjectsList2,
    allSubjects: allSubjects2.map(s => ({ id: s.id, name: s.name })),
    periodTimings: periodTimings2,
    config: config2,
    periods: mappedPeriods2,
    subjectTeachers: subjectTeachersMap2,
    allTeachers: allTeacherOptions2,
  };

  // 3. COMPARE JSON OUTPUTS
  const jsonBaseline = JSON.stringify(baselinePayload);
  const jsonOptimized = JSON.stringify(optimizedPayload);

  console.log(`Baseline JSON Length: ${jsonBaseline.length} bytes`);
  console.log(`Optimized JSON Length: ${jsonOptimized.length} bytes`);

  if (jsonBaseline === jsonOptimized) {
    console.log('\n>>> SUCCESS: 100% EXACT BYTE-FOR-BYTE PARITY CONFIRMED! <<<');
  } else {
    console.error('\n>>> ERROR: JSON PAYLOAD MISMATCH DETECTED! <<<');
    // Compare field by field
    Object.keys(baselinePayload).forEach(key => {
      const bStr = JSON.stringify(baselinePayload[key]);
      const oStr = JSON.stringify(optimizedPayload[key]);
      if (bStr !== oStr) {
        console.error(`Mismatch in field: "${key}"`);
        console.error(`Baseline : ${bStr.substring(0, 100)}...`);
        console.error(`Optimized: ${oStr.substring(0, 100)}...`);
      } else {
        console.log(`Field "${key}": MATCH`);
      }
    });
  }

  await prisma.$disconnect();
}

runParityTest().catch(console.error);
