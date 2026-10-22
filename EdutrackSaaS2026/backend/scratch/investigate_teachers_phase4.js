const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error']
});

async function main() {
  console.log('===============================================================');
  console.log('  PHASE 4: TEACHER & WORKLOAD PERFORMANCE INVESTIGATION SUITE  ');
  console.log('===============================================================');

  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Priyadarshini

  // 1. Audit Database counts for teachers, class sections, assignments, periods, skills
  const staffCount = await prisma.staffProfile.count({ where: { tenantId } });
  const teacherCount = await prisma.staffProfile.count({
    where: {
      tenantId,
      OR: [
        { user: { role: 'TEACHER' } },
        { designation: { contains: 'Teacher', mode: 'insensitive' } },
        { teacherSkills: { some: {} } },
      ]
    }
  });
  const classSectionsCount = await prisma.classSection.count({ where: { tenantId } });
  const assignmentsCount = await prisma.teacherAssignment.count({ where: { tenantId } });
  const periodsCount = await prisma.period.count({ where: { tenantId } });
  const periodTimingsCount = await prisma.periodTiming.count({ where: { tenantId } });
  const subjectsCount = await prisma.subject.count({ where: { tenantId } });
  const classesCount = await prisma.class.count({ where: { tenantId } });

  console.log('\n--- 1. DATABASE RECORD METRICS ---');
  console.log(`- Total Staff Profiles: ${staffCount}`);
  console.log(`- Matching Teachers (Workload filter): ${teacherCount}`);
  console.log(`- Class Sections: ${classSectionsCount}`);
  console.log(`- Classes: ${classesCount}`);
  console.log(`- Subjects: ${subjectsCount}`);
  console.log(`- Teacher Assignments: ${assignmentsCount}`);
  console.log(`- Timetable Periods: ${periodsCount}`);
  console.log(`- Period Timings: ${periodTimingsCount}`);

  // 2. Measure GET /timetable/workload/dashboard queries and timing
  console.log('\n--- 2. MEASURING GET /timetable/workload/dashboard (INITIAL LOAD) ---');
  const t0 = performance.now();
  const teacherWhere = {
    tenantId,
    OR: [
      { user: { role: 'TEACHER' } },
      { designation: { contains: 'Teacher', mode: 'insensitive' } },
      { teacherSkills: { some: {} } },
    ],
  };

  const [
    totalClassSections,
    totalTeachers,
    totalAssignments,
    teachersList,
    classSections,
    subjects,
    academicYears,
    sections,
    periodTimings,
    config,
  ] = await Promise.all([
    prisma.classSection.count({ where: { tenantId } }),
    prisma.staffProfile.count({ where: teacherWhere }),
    prisma.teacherAssignment.count({ where: { tenantId } }),
    prisma.staffProfile.findMany({
      where: teacherWhere,
      include: {
        user: true,
        teacherAssignments: {
          select: {
            subjectId: true,
            classSectionId: true,
            periodsPerWeek: true,
          },
        },
        teacherSkills: {
          include: {
            subject: true,
          },
        },
      },
    }),
    prisma.classSection.findMany({
      where: { tenantId },
      include: {
        class: {
          include: {
            academicYear: true,
          },
        },
        section: true,
        classSubjects: true,
        teacherAssigns: true,
      },
    }),
    prisma.subject.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.academicYear.findMany({ where: { tenantId }, orderBy: { startDate: 'desc' } }),
    prisma.section.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.periodTiming.findMany({ where: { tenantId }, orderBy: { periodNumber: 'asc' } }),
    prisma.timetableConfig.findFirst({ where: { tenantId } }),
  ]);
  const t1 = performance.now();
  console.log(`- Workload Dashboard DB Execution Time: ${(t1 - t0).toFixed(2)} ms`);
  console.log(`- Loaded ${teachersList.length} teachers, ${classSections.length} class sections, ${subjects.length} subjects`);

  // 3. Measure Teacher Detail Expansion (when user clicks a teacher)
  console.log('\n--- 3. MEASURING TEACHER INLINE DRAWER EXPANSION ---');
  if (teachersList.length > 0) {
    const targetTeacher = teachersList[0];
    const targetTeacherId = targetTeacher.id;
    console.log(`Target Teacher: ${targetTeacher.user?.name} (${targetTeacherId})`);

    // Endpoint 1: GET /timetable/workload/teacher/:id
    const tTeacher0 = performance.now();
    const assignments = await prisma.teacherAssignment.findMany({
      where: { teacherId: targetTeacherId, tenantId },
      include: { subject: true, classSection: { include: { class: true, section: true } } },
    });
    const tTeacher1 = performance.now();
    console.log(`  * GET /timetable/workload/teacher/:id -> ${assignments.length} assignments [${(tTeacher1 - tTeacher0).toFixed(2)} ms]`);

    // Endpoint 2: GET /timetable/teacher/:id/periods?gaps=true
    const tPer0 = performance.now();
    const periods = await prisma.period.findMany({
      where: { teacherId: targetTeacherId, tenantId },
      include: {
        subject: true,
        classSection: { include: { class: true, section: true } },
        periodTiming: true,
        substituteTeacher: { include: { user: true } },
      },
    });
    const tPer1 = performance.now();
    console.log(`  * GET /timetable/teacher/:id/periods -> ${periods.length} periods [${(tPer1 - tPer0).toFixed(2)} ms]`);

    // Endpoint 3: GET /timetable/teacher/:id/leaser-periods
    const tLease0 = performance.now();
    const leaserPeriods = await prisma.period.findMany({
      where: { substituteTeacherId: targetTeacherId, tenantId },
      include: {
        subject: true,
        classSection: { include: { class: true, section: true } },
        periodTiming: true,
      },
    });
    const tLease1 = performance.now();
    console.log(`  * GET /timetable/teacher/:id/leaser-periods -> ${leaserPeriods.length} periods [${(tLease1 - tLease0).toFixed(2)} ms]`);

    // Endpoint 4: GET /timetable/teachers/:id/skills
    const tSkill0 = performance.now();
    const skills = await prisma.teacherSkill.findMany({
      where: { teacherId: targetTeacherId, tenantId },
      include: { subject: true },
    });
    const tSkill1 = performance.now();
    console.log(`  * GET /timetable/teachers/:id/skills -> ${skills.length} skills [${(tSkill1 - tSkill0).toFixed(2)} ms]`);
  }

  // 4. Measure Class Section Detail Expansion (when user clicks a class)
  console.log('\n--- 4. MEASURING CLASS SECTION INLINE DRAWER EXPANSION ---');
  if (classSections.length > 0) {
    const targetClass = classSections[0];
    const targetClassId = targetClass.id;
    console.log(`Target Class Section: ${targetClass.class?.name} - ${targetClass.section?.name} (${targetClassId})`);

    // Endpoint 1: GET /timetable/workload/class-section/:id
    const tCs0 = performance.now();
    const [csMeta, classSubjects, allAssignments] = await Promise.all([
      prisma.classSection.findFirst({
        where: { id: targetClassId, tenantId },
        include: {
          class: { include: { academicYear: true } },
          section: true,
        },
      }),
      prisma.classSubject.findMany({
        where: { classSectionId: targetClassId, tenantId },
        include: { subject: true },
      }),
      prisma.teacherAssignment.findMany({
        where: { classSectionId: targetClassId, tenantId },
        include: {
          teacher: {
            include: {
              user: true,
            },
          },
        },
      }),
    ]);
    const tCs1 = performance.now();
    console.log(`  * GET /timetable/workload/class-section/:id -> ${classSubjects.length} subjects, ${allAssignments.length} assignments [${(tCs1 - tCs0).toFixed(2)} ms]`);

    // Endpoint 2: GET /timetable/class/:id/periods
    const tCsPer0 = performance.now();
    const classPeriods = await prisma.period.findMany({
      where: { classSectionId: targetClassId, tenantId },
      include: {
        subject: true,
        periodTiming: true,
        teacher: { include: { user: true } },
        substituteTeacher: { include: { user: true } },
      },
    });
    const tCsPer1 = performance.now();
    console.log(`  * GET /timetable/class/:id/periods -> ${classPeriods.length} periods [${(tCsPer1 - tCsPer0).toFixed(2)} ms]`);
  }

  // 5. Measure GET /teachers (Staff Controller - triggered redundantly by layout.tsx on hover/nav)
  console.log('\n--- 5. MEASURING REDUNDANT PREFETCH: GET /teachers (Triggered by layout.tsx) ---');
  const tStaff0 = performance.now();
  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      user: {
        tenantId,
        role: { in: ['TEACHER', 'STAFF', 'DRIVER'] },
        isActive: true,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
        },
      },
      teacherSkills: {
        include: {
          subject: { select: { id: true, name: true } },
        },
      },
      _count: {
        select: { teacherAssignments: true },
      },
    },
    orderBy: {
      user: {
        name: 'asc',
      },
    },
  });
  const tStaff1 = performance.now();
  console.log(`- GET /teachers DB Execution Time: ${(tStaff1 - tStaff0).toFixed(2)} ms (${staffProfiles.length} profiles loaded)`);

  // 6. Inspect Timetable Matrix loader (GET /timetable/class-matrix)
  console.log('\n--- 6. MEASURING TIMETABLE GRID MATRIX LOADER ---');
  if (classSections.length > 0) {
    const targetClassId = classSections[0].id;
    const tMatrix0 = performance.now();
    const [matrixCs, matrixTimings, matrixPeriods, matrixSubjects, matrixConfig] = await Promise.all([
      prisma.classSection.findFirst({
        where: { id: targetClassId, tenantId },
        include: {
          classSubjects: { include: { subject: true } },
          teacherAssigns: { include: { teacher: { include: { user: true } }, subject: true } }
        }
      }),
      prisma.periodTiming.findMany({ where: { tenantId }, orderBy: { periodNumber: 'asc' } }),
      prisma.period.findMany({
        where: { classSectionId: targetClassId, tenantId },
        include: { subject: true, teacher: { include: { user: true } }, periodTiming: true }
      }),
      prisma.subject.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      prisma.timetableConfig.findFirst({ where: { tenantId } })
    ]);
    const tMatrix1 = performance.now();
    console.log(`- Timetable Grid Matrix DB Execution Time: ${(tMatrix1 - tMatrix0).toFixed(2)} ms`);
  }

  console.log('\n===============================================================');
  console.log('  INVESTIGATION DATA GATHERING COMPLETE                        ');
  console.log('===============================================================');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
