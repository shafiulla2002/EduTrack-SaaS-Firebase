const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function measureEndpoint(name, fn) {
  const t0 = process.hrtime.bigint();
  let result;
  let error = null;
  try {
    result = await fn();
  } catch (err) {
    error = err.message;
  }
  const t1 = process.hrtime.bigint();
  const latencyMs = Number(t1 - t0) / 1e6;
  return { name, latencyMs, error, resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0) };
}

async function runAudit() {
  console.log('================================================================');
  console.log('  PHASE 6: COMPREHENSIVE ENDPOINT & USER-ACTION AUDIT           ');
  console.log('================================================================\n');

  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const user = await prisma.user.findFirst({ where: { tenantId, role: 'TEACHER' } });
  const adminUser = await prisma.user.findFirst({ where: { tenantId, role: 'SCHOOL_ADMIN' } });
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });
  const sampleStudent = await prisma.studentProfile.findFirst({
    where: { tenantId },
    include: { user: true, classSection: { include: { class: true, section: true } } }
  });
  const sampleSubject = await prisma.subject.findFirst({ where: { tenantId } });
  const sampleAY = await prisma.academicYear.findFirst({ where: { tenantId } });

  console.log(`Context:`);
  console.log(`- Tenant: ${tenant.name} (${tenantId})`);
  console.log(`- Teacher User: ${user?.name} (${user?.id})`);
  console.log(`- Admin User: ${adminUser?.name} (${adminUser?.id})`);
  console.log(`- ClassSection: ${sampleClassSection?.class?.name} - ${sampleClassSection?.section?.name}`);
  console.log(`- Student: ${sampleStudent?.user?.name} (${sampleStudent?.id})`);
  console.log(`- Subject: ${sampleSubject?.name} (${sampleSubject?.id})\n`);

  const benchmarks = [];

  // 1. Enter Marks / Marks Management
  benchmarks.push(await measureEndpoint('Marks Mgmt: Initial Options (Classes+Subjects+Exams+Components)', async () => {
    return Promise.all([
      prisma.staffProfile.findUnique({
        where: { userId: user.id },
        include: { teacherAssignments: { include: { classSection: { include: { class: true, section: true } }, subject: true } } }
      }),
      prisma.subject.findMany({ where: { tenantId }, select: { id: true, name: true, code: true } }),
      prisma.exam.findMany({ where: { tenantId }, select: { name: true }, distinct: ['name'] }),
      prisma.examComponentConfig.findMany({ where: { tenantId }, orderBy: { orderIndex: 'asc' } })
    ]);
  }));

  benchmarks.push(await measureEndpoint('Marks Mgmt: Load Students Roster (getExamMarksEntryList waterfall)', async () => {
    // Current sequential verification in teacher-portal.service.ts
    const staff = await prisma.staffProfile.findUnique({ where: { userId: user.id } });
    const classSection = await prisma.classSection.findFirst({ where: { id: sampleClassSection.id, tenantId }, include: { class: true, section: true } });
    const subject = await prisma.subject.findFirst({ where: { id: sampleSubject.id, tenantId } });
    const cls = await prisma.class.findFirst({ where: { id: classSection.classId, tenantId }, include: { academicYear: true } });
    const exam = await prisma.exam.findFirst({ where: { tenantId, classSectionId: sampleClassSection.id } });
    const studentCount = await prisma.studentProfile.count({ where: { classSectionId: sampleClassSection.id, user: { tenantId, isActive: true } } });
    
    // examsService.getStudentsForMarksEntry
    const [students, cs, existingExamSubject, currentMarks] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { classSectionId: sampleClassSection.id, tenantId, user: { isActive: true } },
        select: { id: true, rollNo: true, user: { select: { name: true } } },
        orderBy: [{ rollNo: 'asc' }, { user: { name: 'asc' } }]
      }),
      prisma.classSection.findUnique({ where: { id: sampleClassSection.id }, select: { id: true, classId: true, sectionId: true, class: { select: { name: true } }, section: { select: { name: true } } } }),
      exam ? prisma.examSubject.findFirst({ where: { examId: exam.id, subjectId: sampleSubject.id } }) : null,
      exam ? prisma.examMark.findMany({ where: { examId: exam.id, subjectId: sampleSubject.id } }) : []
    ]);
    return students;
  }));

  // 2. Complaint Box
  benchmarks.push(await measureEndpoint('Complaint Box: Initial Mount (6 concurrent requests)', async () => {
    return Promise.all([
      prisma.classSection.findMany({ where: { tenantId }, include: { class: true, section: true }, orderBy: { class: { name: 'asc' } } }),
      prisma.academicYear.findMany({ where: { tenantId }, orderBy: { name: 'desc' } }),
      prisma.staffProfile.findMany({ where: { user: { tenantId, role: 'TEACHER', isActive: true } }, include: { user: { select: { id: true, name: true, email: true, phone: true } } } }),
      prisma.staffProfile.findUnique({ where: { userId: user.id }, include: { user: true } }),
      prisma.behaviorCase.findMany({ where: { tenantId }, include: { student: { include: { user: { select: { name: true } }, classSection: { include: { class: true, section: true } } } }, teacher: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } }),
      prisma.parentComplaint.findMany({ where: { tenantId }, include: { student: { include: { user: { select: { name: true } }, classSection: { include: { class: true, section: true } } } }, parent: { select: { name: true, phone: true, email: true } }, assignedTo: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } })
    ]);
  }));

  benchmarks.push(await measureEndpoint('Complaint Box: Parent Complaints List (Admin View)', async () => {
    return prisma.parentComplaint.findMany({
      where: { tenantId },
      include: {
        student: { include: { user: { select: { name: true } }, classSection: { include: { class: true, section: true } } } },
        parent: { select: { name: true, phone: true, email: true } },
        assignedTo: { include: { user: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }));

  benchmarks.push(await measureEndpoint('Complaint Box: Pending Cases List', async () => {
    return prisma.behaviorCase.findMany({
      where: { tenantId },
      include: {
        student: { include: { user: { select: { name: true } }, classSection: { include: { class: true, section: true } } } },
        teacher: { include: { user: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }));

  // 3. Profile Navigation
  benchmarks.push(await measureEndpoint('Profile: Teacher Profile View (/teacher-portal/profile)', async () => {
    return prisma.staffProfile.findFirst({
      where: { userId: user.id, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true, role: true } },
        teacherAssignments: { include: { classSection: { include: { class: true, section: true } }, subject: true } }
      }
    });
  }));

  benchmarks.push(await measureEndpoint('Profile: Student Deep Profile View (/students/:id)', async () => {
    return prisma.studentProfile.findFirst({
      where: { id: sampleStudent.id, tenantId },
      include: {
        user: true,
        classSection: { include: { class: true, section: true } },
        parent: { include: { user: true } },
        attendances: { take: 30, orderBy: { createdAt: 'desc' } },
        examMarks: { include: { exam: true, subject: true }, take: 30 },
        invoices: { include: { invoiceItems: true }, take: 20 },
        behaviorCases: { take: 10, orderBy: { createdAt: 'desc' } }
      }
    });
  }));

  // 4. Attendance
  benchmarks.push(await measureEndpoint('Attendance Dashboard: Report Data (/attendance/report-data)', async () => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 90);
    const end = new Date();
    end.setDate(today.getDate() + 30);

    return Promise.all([
      prisma.$queryRaw`
        SELECT sp.id, COALESCE(sp."rollNo", '') AS "rollNo", u.name, COALESCE(c.name, '') AS "className", COALESCE(s.name, '') AS "section"
        FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id LEFT JOIN "ClassSection" cs ON sp."classSectionId" = cs.id LEFT JOIN "Class" c ON cs."classId" = c.id LEFT JOIN "Section" s ON cs."sectionId" = s.id
        WHERE sp."tenantId" = ${tenantId} ORDER BY u.name ASC
      `,
      prisma.$queryRaw`
        SELECT ses.id, ses.date, ses."totalStudents", ses."presentCount", ses."absentCount", COALESCE(c.id, '') AS "classId", COALESCE(c.name, '') AS "className", COALESCE(s.name, '') AS "section"
        FROM "AttendanceSession" ses LEFT JOIN "ClassSection" cs ON ses."classSectionId" = cs.id LEFT JOIN "Class" c ON cs."classId" = c.id LEFT JOIN "Section" s ON cs."sectionId" = s.id
        WHERE ses."tenantId" = ${tenantId} AND ses.date >= ${start} AND ses.date <= ${end} ORDER BY ses.date DESC
      `,
      prisma.$queryRaw`
        SELECT a.id, a."studentId", ses.date AS "attendanceDate", COALESCE(c.name, '') AS "className", COALESCE(s.name, '') AS "section"
        FROM "Attendance" a JOIN "AttendanceSession" ses ON a."attendanceSessionId" = ses.id LEFT JOIN "ClassSection" cs ON ses."classSectionId" = cs.id LEFT JOIN "Class" c ON cs."classId" = c.id LEFT JOIN "Section" s ON cs."sectionId" = s.id
        WHERE a."tenantId" = ${tenantId} AND a.status = 'ABSENT' AND ses.date >= ${start} AND ses.date <= ${end}
      `
    ]);
  }));

  benchmarks.push(await measureEndpoint('Attendance Entry: Mount (Recent + Teachers + Classes)', async () => {
    return Promise.all([
      prisma.attendanceSession.findMany({ where: { tenantId }, take: 5, orderBy: { createdAt: 'desc' } }),
      prisma.staffProfile.findMany({ where: { tenantId, user: { isActive: true, role: { in: ['TEACHER', 'SCHOOL_ADMIN', 'STAFF'] } } }, include: { user: { select: { id: true, name: true } } }, take: 100 }),
      prisma.class.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } })
    ]);
  }));

  benchmarks.push(await measureEndpoint('Attendance Entry: Load Class Roster (Students + Session Data)', async () => {
    return Promise.all([
      prisma.studentProfile.findMany({
        where: { tenantId, classSectionId: sampleClassSection.id },
        include: { user: { select: { name: true } } },
        orderBy: { user: { name: 'asc' } }
      }),
      prisma.attendanceSession.findFirst({
        where: { tenantId, classSectionId: sampleClassSection.id, date: new Date() },
        include: { attendances: true, takenBy: { include: { user: { select: { name: true } } } } }
      })
    ]);
  }));

  // 5. Billing / Financial
  benchmarks.push(await measureEndpoint('Billing Office: Mount (Options Years + Recent Invoices)', async () => {
    return Promise.all([
      prisma.academicYear.findMany({ where: { tenantId }, orderBy: { name: 'desc' } }),
      prisma.invoice.findMany({
        where: { tenantId, status: { not: 'VOIDED' } },
        take: 20,
        orderBy: { invoiceDate: 'desc' },
        include: { student: { include: { user: true } }, invoiceItems: true }
      })
    ]);
  }));

  benchmarks.push(await measureEndpoint('Billing: Search Students Autocomplete', async () => {
    return prisma.studentProfile.findMany({
      where: {
        user: { tenantId, isActive: true, OR: [{ name: { contains: 'a', mode: 'insensitive' } }, { rollNo: { contains: 'a', mode: 'insensitive' } }] }
      },
      include: {
        user: { select: { name: true, phone: true } },
        classSection: { include: { class: true, section: true } },
        opportunities: { where: { stageName: { not: 'Closed Won' } }, take: 1 }
      },
      take: 10
    });
  }));

  benchmarks.push(await measureEndpoint('Billing: Financial Command Center (Full Cohort In-Memory Engine)', async () => {
    // Current backend logic in getFinancialCommandCenterData:
    const activeYear = await prisma.academicYear.findFirst({ where: { tenantId, isActive: true } });
    const [allClasses, allSections, allTimeInvoices, allTimeExpenses, studentProfiles, activeOpps] = await Promise.all([
      prisma.class.findMany({ where: { tenantId } }),
      prisma.section.findMany({ where: { tenantId } }),
      prisma.invoice.findMany({ where: { tenantId, status: { not: 'VOIDED' } }, include: { invoiceItems: true, student: { include: { user: true } } } }),
      prisma.expense.findMany({ where: { tenantId, status: { in: ['PAID', 'APPROVED'] } } }),
      prisma.studentProfile.findMany({ where: { tenantId }, include: { user: true, classSection: true } }),
      prisma.opportunity.findMany({ where: { tenantId }, include: { opportunityLineItems: { include: { product: true } }, invoices: true } })
    ]);
    return { allTimeInvoices: allTimeInvoices.length, allTimeExpenses: allTimeExpenses.length, activeOpps: activeOpps.length };
  }));

  // 6. Homework / Announcements / Leave / Promotions / Admissions
  benchmarks.push(await measureEndpoint('Homework: List Page (/dashboard/homework)', async () => {
    return prisma.homework.findMany({
      where: { tenantId },
      include: {
        classSection: { include: { class: true, section: true } },
        subject: true,
        teacher: { include: { user: true } },
        submissions: { select: { id: true, status: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }));

  benchmarks.push(await measureEndpoint('Leave Management: List Page (/dashboard/leave-mgmt)', async () => {
    return prisma.leaveApplication.findMany({
      where: { tenantId },
      include: {
        applicant: { select: { id: true, name: true, email: true, role: true } },
        staff: { include: { user: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }));

  benchmarks.push(await measureEndpoint('Promotions: Cohort Student Progression Data (/dashboard/promotions)', async () => {
    return prisma.studentProfile.findMany({
      where: { tenantId, user: { isActive: true } },
      include: {
        user: { select: { id: true, name: true } },
        classSection: { include: { class: true, section: true } },
        examMarks: { select: { marksObtained: true, maxMarks: true } }
      },
      orderBy: { user: { name: 'asc' } }
    });
  }));

  console.log('----------------------------------------------------------------');
  console.log('RESULTS (Sorted by Latency):');
  console.log('----------------------------------------------------------------');
  benchmarks.sort((a, b) => b.latencyMs - a.latencyMs);

  for (const b of benchmarks) {
    console.log(`  ${b.latencyMs.toFixed(2).padStart(8)} ms | ${b.name} (Items: ${b.resultCount})`);
  }

  await prisma.$disconnect();
}

runAudit().catch(console.error);
