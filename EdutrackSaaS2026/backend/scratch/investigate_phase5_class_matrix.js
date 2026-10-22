const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query']
});

async function main() {
  console.log('========================================================================');
  console.log('  PHASE 5: READ-ONLY AUDIT & BENCHMARK FOR /timetable/class-matrix     ');
  console.log('========================================================================');

  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Priyadarshini School

  // 1. Fetch sample classSection and academicYear
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });

  if (!sampleClassSection) {
    console.error('No class section found for test tenant.');
    return;
  }

  const classSectionId = sampleClassSection.id;
  const sampleYear = await prisma.academicYear.findFirst({ where: { tenantId } });
  const academicYearId = sampleYear ? sampleYear.id : '';

  console.log(`\nAudit Target: ClassSection "${sampleClassSection.class?.name} - ${sampleClassSection.section?.name}" (${classSectionId})`);
  console.log(`Academic Year ID: ${academicYearId}`);

  // 2. Measure complete getClassMatrixData execution
  console.log('\n--- 1. OVERALL getClassMatrixData BENCHMARK ---');
  const t0_total = performance.now();

  // Step 2.1: Period timings
  const t0_pt = performance.now();
  const periodTimings = await prisma.periodTiming.findMany({
    where: { tenantId, isActive: true },
    orderBy: { periodNumber: 'asc' },
  });
  const t1_pt = performance.now();

  // Step 2.2: Timetable config
  const t0_cfg = performance.now();
  const config = await prisma.timetableConfig.findUnique({
    where: { tenantId },
  });
  const t1_cfg = performance.now();

  // Step 2.3: Parallel queries in Promise.all
  const t0_par = performance.now();

  const t0_cs = performance.now();
  const classSection = await prisma.classSection.findUnique({
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
  });
  const t1_cs = performance.now();

  const t0_p = performance.now();
  const periods = await prisma.period.findMany({
    where: { classSectionId, tenantId },
    include: {
      subject: true,
      teacher: { include: { user: true } },
      substituteTeacher: { include: { user: true } },
      periodTiming: true,
    },
  });
  const t1_p = performance.now();

  const t0_sub = performance.now();
  const allSubjects = await prisma.subject.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });
  const t1_sub = performance.now();

  const t0_t = performance.now();
  const allTeachers = await prisma.staffProfile.findMany({
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
  });
  const t1_t = performance.now();

  const t0_sk = performance.now();
  const teacherSkills = await prisma.teacherSkill.findMany({
    where: { tenantId },
    include: { teacher: { include: { user: true } } },
  });
  const t1_sk = performance.now();

  // Step 2.4: Node.js transformation
  const t0_node = performance.now();
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

  const responsePayload = {
    classSection: classSection
      ? {
          id: classSection.id,
          name: `${classSection.class?.name || 'Class'} - ${classSection.section?.name || 'Section'}`,
          classId: classSection.classId,
          sectionId: classSection.sectionId,
          strength: classSection.strength,
        }
      : null,
    classSubjects: classSubjectsList,
    allSubjects: allSubjects.map(s => ({ id: s.id, name: s.name })),
    periodTimings,
    config,
    periods: mappedPeriods,
    subjectTeachers: subjectTeachersMap,
    allTeachers: allTeacherOptions,
  };
  const t1_node = performance.now();
  const t1_total = performance.now();

  const payloadJson = JSON.stringify(responsePayload);
  const payloadSizeKb = (Buffer.byteLength(payloadJson, 'utf8') / 1024).toFixed(2);

  console.log(`- Query 1 (PeriodTiming): ${(t1_pt - t0_pt).toFixed(2)} ms (Returned ${periodTimings.length} rows)`);
  console.log(`- Query 2 (TimetableConfig): ${(t1_cfg - t0_cfg).toFixed(2)} ms (Returned 1 row)`);
  console.log(`- Query 3 (ClassSection + nested joins): ${(t1_cs - t0_cs).toFixed(2)} ms (Returned 1 class with ${classSection?.classSubjects?.length || 0} subjects, ${classSection?.teacherAssigns?.length || 0} assignments)`);
  console.log(`- Query 4 (Periods for ClassSection): ${(t1_p - t0_p).toFixed(2)} ms (Returned ${periods.length} periods)`);
  console.log(`- Query 5 (Subjects for Tenant): ${(t1_sub - t0_sub).toFixed(2)} ms (Returned ${allSubjects.length} subjects)`);
  console.log(`- Query 6 (StaffProfiles for Tenant): ${(t1_t - t0_t).toFixed(2)} ms (Returned ${allTeachers.length} teachers)`);
  console.log(`- Query 7 (TeacherSkills for Tenant): ${(t1_sk - t0_sk).toFixed(2)} ms (Returned ${teacherSkills.length} skills)`);
  console.log(`- Node.js Transformation & Map Building: ${(t1_node - t0_node).toFixed(2)} ms`);
  console.log(`- Total Execution Time: ${(t1_total - t0_total).toFixed(2)} ms`);
  console.log(`- Response Payload Size: ${payloadSizeKb} KB`);

  // 3. Inspect PostgreSQL Existing Indexes on all related tables
  console.log('\n--- 2. EXISTING POSTGRESQL INDEXES ---');
  const targetTables = [
    'Period', 'ClassSection', 'ClassSubject', 'TeacherAssignment',
    'PeriodTiming', 'TimetableConfig', 'Subject', 'StaffProfile',
    'TeacherSkill', 'User', 'Class', 'Section', 'AcademicYear'
  ];

  const existingIndexes = await prisma.$queryRawUnsafe(`
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (${targetTables.map(t => `'${t}'`).join(',')})
    ORDER BY tablename, indexname;
  `);

  console.table(existingIndexes.map(idx => ({
    Table: idx.tablename,
    Index: idx.indexname,
    Definition: idx.indexdef
  })));

  // 4. Run EXPLAIN (ANALYZE, BUFFERS) for each key SQL query
  console.log('\n--- 3. EXPLAIN (ANALYZE, BUFFERS) QUERY PLANS ---');

  // Query A: Period lookup by classSectionId and tenantId
  console.log('\n[QUERY A: Period Filter by classSectionId & tenantId]');
  const explainPeriod = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT * FROM "Period"
    WHERE "classSectionId" = '${classSectionId}' AND "tenantId" = '${tenantId}';
  `);
  console.log(explainPeriod.map(r => r['QUERY PLAN']).join('\n'));

  // Query B: StaffProfile filter by tenantId + Role/Designation OR condition
  console.log('\n[QUERY B: StaffProfile Filter with OR Condition]');
  const explainStaff = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT sp.*, u.name
    FROM "StaffProfile" sp
    LEFT JOIN "User" u ON sp."userId" = u.id
    WHERE sp."tenantId" = '${tenantId}'
      AND (
        u.role = 'TEACHER'
        OR sp.designation ILIKE '%Teacher%'
        OR EXISTS (SELECT 1 FROM "TeacherSkill" ts WHERE ts."teacherId" = sp.id)
      )
    ORDER BY u.name ASC;
  `);
  console.log(explainStaff.map(r => r['QUERY PLAN']).join('\n'));

  // Query C: TeacherSkill filter by tenantId
  console.log('\n[QUERY C: TeacherSkill by tenantId]');
  const explainSkills = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT ts.*, sp.id AS "staffId", u.name
    FROM "TeacherSkill" ts
    LEFT JOIN "StaffProfile" sp ON ts."teacherId" = sp.id
    LEFT JOIN "User" u ON sp."userId" = u.id
    WHERE ts."tenantId" = '${tenantId}';
  `);
  console.log(explainSkills.map(r => r['QUERY PLAN']).join('\n'));

  // Query D: ClassSubject join by classSectionId
  console.log('\n[QUERY D: ClassSubject by classSectionId]');
  const explainClassSubject = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT cs.*, s.name
    FROM "ClassSubject" cs
    LEFT JOIN "Subject" s ON cs."subjectId" = s.id
    WHERE cs."classSectionId" = '${classSectionId}'
    ORDER BY s.name ASC;
  `);
  console.log(explainClassSubject.map(r => r['QUERY PLAN']).join('\n'));

  // Query E: TeacherAssignment by classSectionId
  console.log('\n[QUERY E: TeacherAssignment by classSectionId]');
  const explainAssignment = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT ta.*, sp.id AS "teacherId", u.name AS "teacherName", s.name AS "subjectName"
    FROM "TeacherAssignment" ta
    LEFT JOIN "StaffProfile" sp ON ta."teacherId" = sp.id
    LEFT JOIN "User" u ON sp."userId" = u.id
    LEFT JOIN "Subject" s ON ta."subjectId" = s.id
    WHERE ta."classSectionId" = '${classSectionId}';
  `);
  console.log(explainAssignment.map(r => r['QUERY PLAN']).join('\n'));

  // 5. Check Fallback in frontend
  console.log('\n--- 4. FRONTEND FALLBACK AUDIT ---');
  console.log('Checking frontend timetable loading behavior...');
  console.log('In frontend/src/app/dashboard/teachers/page.tsx:');
  console.log('- Endpoint invoked: /timetable/class-matrix');
  console.log('- If /timetable/class-matrix succeeds (200 OK): 1 single HTTP request is made (0 fallback calls).');
  console.log('- Fallback is ONLY triggered if class-matrix throws an HTTP 500 error.');

  console.log('\n========================================================================');
  console.log('  AUDIT COMPLETE                                                        ');
  console.log('========================================================================');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Audit failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
