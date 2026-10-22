const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Priyadarshini English Medium High School

async function runParityAndTimingAudit() {
  console.log('=== PHASE 1: DASHBOARD SUMMARY DETAILED PARITY & TIMING BENCHMARK ===\n');

  // --------------------------------------------------------------------------
  // 1. OLD PATTERN (In-Memory 84k Exam Marks + 7.4k Attendance Sessions)
  // --------------------------------------------------------------------------
  const oldStart = performance.now();
  const oldMemStart = process.memoryUsage().heapUsed;

  const [
    studentsCountOld,
    teachersCountOld,
    classesCountOld,
    revenueAggOld,
    expenseAggOld,
    attendanceSessionsOld,
    examMarksOld,
    recentStudentsOld,
    recentInvoicesOld,
    recentSalariesOld
  ] = await Promise.all([
    prisma.studentProfile.count({ where: { user: { tenantId, isActive: true } } }),
    prisma.staffProfile.count({ where: { user: { tenantId, isActive: true, role: { in: ['TEACHER', 'STAFF'] } } } }),
    prisma.classSection.count({ where: { tenantId, class: { isActive: true } } }),
    prisma.invoice.aggregate({ where: { tenantId, status: 'PAID' }, _sum: { paidAmount: true } }),
    prisma.expense.aggregate({ where: { tenantId, status: 'PAID' }, _sum: { amount: true } }),
    prisma.attendanceSession.findMany({ where: { tenantId }, select: { presentCount: true, totalStudents: true } }),
    prisma.examMark.findMany({ where: { tenantId }, select: { marksObtained: true } }),
    prisma.studentProfile.findMany({
      where: { user: { tenantId, isActive: true } },
      orderBy: { user: { createdAt: 'desc' } },
      take: 10,
      select: { id: true, rollNo: true, user: { select: { name: true, createdAt: true } }, classSection: { select: { class: { select: { name: true } }, section: { select: { name: true } } } } }
    }),
    prisma.invoice.findMany({
      where: { tenantId, status: 'PAID' },
      take: 10,
      orderBy: { invoiceDate: 'desc' },
      select: { id: true, paidAmount: true, invoiceDate: true, description: true, student: { select: { rollNo: true, user: { select: { name: true } }, classSection: { select: { class: { select: { name: true } }, section: { select: { name: true } } } } } } }
    }),
    prisma.expense.findMany({
      where: { tenantId, category: 'Salary', status: 'PAID' },
      take: 10,
      orderBy: { date: 'desc' },
      select: { id: true, description: true, amount: true, date: true }
    })
  ]);

  // In-memory calculations
  const totalPresentOld = attendanceSessionsOld.reduce((sum, s) => sum + s.presentCount, 0);
  const totalRosterOld = attendanceSessionsOld.reduce((sum, s) => sum + s.totalStudents, 0);
  const attendanceRateOld = totalRosterOld > 0 ? Math.round((totalPresentOld / totalRosterOld) * 1000) / 10 : 0;

  const totalMarksSumOld = examMarksOld.reduce((sum, m) => sum + Number(m.marksObtained), 0);
  const academicAverageOld = examMarksOld.length > 0 ? Math.round((totalMarksSumOld / examMarksOld.length) * 10) / 10 : 0;

  const oldDuration = performance.now() - oldStart;
  const oldMemEnd = process.memoryUsage().heapUsed;
  const oldMemDeltaMB = Math.round((oldMemEnd - oldMemStart) / 1024 / 1024 * 100) / 100;

  console.log(`[OLD IN-MEMORY PATTERN]`);
  console.log(`- Total Duration: ${Math.round(oldDuration)} ms`);
  console.log(`- Rows Transferred: ${attendanceSessionsOld.length + examMarksOld.length + 30} rows (${attendanceSessionsOld.length} attendance, ${examMarksOld.length} exam marks)`);
  console.log(`- Heap Delta: ${oldMemDeltaMB} MB`);
  console.log(`- Results: students=${studentsCountOld}, teachers=${teachersCountOld}, classes=${classesCountOld}, revenue=${revenueAggOld._sum.paidAmount}, expenses=${expenseAggOld._sum.amount}`);
  console.log(`- Computed Attendance Rate: ${attendanceRateOld}%`);
  console.log(`- Computed Academic Average: ${academicAverageOld}%`);

  // --------------------------------------------------------------------------
  // 2. NEW OPTIMIZED DATABASE AGGREGATION PATTERN
  // --------------------------------------------------------------------------
  const newStart = performance.now();
  const newMemStart = process.memoryUsage().heapUsed;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    metricsRawNew,
    scoreRawNew,
    recentStudentsNew,
    invoicesNew,
    salaryExpensesNew,
    monthlyInvoicesRawNew,
    monthlyExpensesRawNew
  ] = await Promise.all([
    // Unified SQL Aggregation
    prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsCount",
        (SELECT COUNT(*)::int FROM "StaffProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true AND u.role::text IN ('TEACHER', 'STAFF')) AS "teachersCount",
        (SELECT COUNT(*)::int FROM "ClassSection" cs JOIN "Class" c ON cs."classId" = c.id WHERE cs."tenantId" = ${tenantId} AND c."isActive" = true) AS "classesCount",
        (SELECT COALESCE(SUM("paidAmount"), 0)::float FROM "Invoice" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "totalRevenue",
        (SELECT COALESCE(SUM(CASE WHEN "invoiceDate" >= ${thisMonthStart} THEN "paidAmount" ELSE 0 END), 0)::float FROM "Invoice" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "revThisMonth",
        (SELECT COALESCE(SUM(CASE WHEN "invoiceDate" >= ${lastMonthStart} AND "invoiceDate" <= ${lastMonthEnd} THEN "paidAmount" ELSE 0 END), 0)::float FROM "Invoice" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "revLastMonth",
        (SELECT COALESCE(SUM("amount"), 0)::float FROM "Expense" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "totalExpenses",
        (SELECT COALESCE(SUM("presentCount"), 0)::float FROM "AttendanceSession" WHERE "tenantId" = ${tenantId}) AS "totalPresent",
        (SELECT COALESCE(SUM("totalStudents"), 0)::float FROM "AttendanceSession" WHERE "tenantId" = ${tenantId}) AS "totalRoster",
        (SELECT COUNT(CASE WHEN status::text = 'PENDING' THEN 1 END)::int FROM "LeaveRequest" WHERE "tenantId" = ${tenantId}) AS "pendingLeaveRequests",
        (SELECT COUNT(CASE WHEN status::text = 'APPROVED' AND "approvedDate" >= ${todayStart} THEN 1 END)::int FROM "LeaveRequest" WHERE "tenantId" = ${tenantId}) AS "approvedToday",
        (SELECT COUNT(CASE WHEN status::text = 'REJECTED' AND "rejectedDate" >= ${todayStart} THEN 1 END)::int FROM "LeaveRequest" WHERE "tenantId" = ${tenantId}) AS "rejectedToday",
        (SELECT COUNT(CASE WHEN u."createdAt" >= ${thisMonthStart} THEN 1 END)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsThisMonth",
        (SELECT COUNT(CASE WHEN u."createdAt" >= ${lastMonthStart} AND u."createdAt" <= ${lastMonthEnd} THEN 1 END)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsLastMonth"
    `,

    // Single-pass DB AVG score calculation
    prisma.$queryRaw`
      SELECT 
        COALESCE(
          AVG(
            CASE 
              WHEN es."maxMarks" IS NOT NULL AND es."maxMarks" > 0 
              THEN (em."marksObtained"::float / es."maxMarks"::float) * 100.0
              ELSE em."marksObtained"::float
            END
          ), 
          0
        )::float AS "avgScore"
      FROM "ExamMark" em
      LEFT JOIN "ExamSubject" es 
        ON em."examId" = es."examId" 
        AND em."subjectId" = es."subjectId" 
        AND em."subjectType" = es."subjectType"
        AND em."tenantId" = es."tenantId"
      WHERE em."tenantId" = ${tenantId}
    `,

    // Targeted lookups for recent admissions, invoices, salary
    prisma.studentProfile.findMany({
      where: { user: { tenantId, isActive: true } },
      orderBy: { user: { createdAt: 'desc' } },
      take: 10,
      select: { id: true, rollNo: true, user: { select: { name: true, createdAt: true } }, classSection: { select: { class: { select: { name: true } }, section: { select: { name: true } } } } }
    }),

    prisma.invoice.findMany({
      where: { tenantId, status: 'PAID' },
      take: 10,
      orderBy: { invoiceDate: 'desc' },
      select: { id: true, paidAmount: true, invoiceDate: true, description: true, student: { select: { rollNo: true, user: { select: { name: true } }, classSection: { select: { class: { select: { name: true } }, section: { select: { name: true } } } } } } }
    }),

    prisma.expense.findMany({
      where: { tenantId, category: 'Salary', status: 'PAID' },
      take: 10,
      orderBy: { date: 'desc' },
      select: { id: true, description: true, amount: true, date: true }
    }),

    prisma.$queryRaw`
      SELECT to_char("invoiceDate", 'YYYY-MM') AS "month", COALESCE(SUM("paidAmount"), 0)::float AS "totalPaid"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId} AND status::text = 'PAID' AND "invoiceDate" >= ${sixMonthsAgo}
      GROUP BY to_char("invoiceDate", 'YYYY-MM')
    `,

    prisma.$queryRaw`
      SELECT to_char(date, 'YYYY-MM') AS "month", COALESCE(SUM(amount), 0)::float AS "totalSalary"
      FROM "Expense"
      WHERE "tenantId" = ${tenantId} AND category = 'Salary' AND status::text = 'PAID' AND date >= ${sixMonthsAgo}
      GROUP BY to_char(date, 'YYYY-MM')
    `
  ]);

  const mNew = metricsRawNew[0] || {};
  const totalPresentNew = Number(mNew.totalPresent || 0);
  const totalRosterNew = Number(mNew.totalRoster || 0);
  const attendanceRateNew = totalRosterNew > 0 ? Math.round((totalPresentNew / totalRosterNew) * 1000) / 10 : 0;
  const academicAverageNew = scoreRawNew[0]?.avgScore ? Math.round(Number(scoreRawNew[0].avgScore) * 10) / 10 : 0;

  const newDuration = performance.now() - newStart;
  const newMemEnd = process.memoryUsage().heapUsed;
  const newMemDeltaMB = Math.round((newMemEnd - newMemStart) / 1024 / 1024 * 100) / 100;

  console.log(`\n[NEW DATABASE AGGREGATION PATTERN]`);
  console.log(`- Total Duration: ${Math.round(newDuration)} ms (Speedup: ${Math.round((oldDuration / newDuration) * 10) / 10}x)`);
  console.log(`- Rows Transferred: ~35 rows total (1 row metrics, 1 row score, 10 students, 10 invoices, 10 expenses, 6 chart rows)`);
  console.log(`- Heap Delta: ${newMemDeltaMB} MB`);
  console.log(`- Results: students=${mNew.studentsCount}, teachers=${mNew.teachersCount}, classes=${mNew.classesCount}, revenue=${mNew.totalRevenue}, expenses=${mNew.totalExpenses}`);
  console.log(`- Computed Attendance Rate: ${attendanceRateNew}%`);
  console.log(`- Computed Academic Average: ${academicAverageNew}%`);

  // --------------------------------------------------------------------------
  // 3. PARITY ASSERTION
  // --------------------------------------------------------------------------
  console.log(`\n=== 100% MATHEMATICAL PARITY AUDIT ===`);
  const checks = [
    { name: 'Students Count', oldVal: studentsCountOld, newVal: mNew.studentsCount, match: studentsCountOld === mNew.studentsCount },
    { name: 'Teachers Count', oldVal: teachersCountOld, newVal: mNew.teachersCount, match: teachersCountOld === mNew.teachersCount },
    { name: 'Classes Count', oldVal: classesCountOld, newVal: mNew.classesCount, match: classesCountOld === mNew.classesCount },
    { name: 'Total Revenue', oldVal: revenueAggOld._sum.paidAmount, newVal: mNew.totalRevenue, match: Number(revenueAggOld._sum.paidAmount) === Number(mNew.totalRevenue) },
    { name: 'Total Expenses', oldVal: expenseAggOld._sum.amount, newVal: mNew.totalExpenses, match: Number(expenseAggOld._sum.amount) === Number(mNew.totalExpenses) },
    { name: 'Attendance Rate (%)', oldVal: attendanceRateOld, newVal: attendanceRateNew, match: attendanceRateOld === attendanceRateNew },
    { name: 'Academic Average (%)', oldVal: academicAverageOld, newVal: academicAverageNew, match: academicAverageOld === academicAverageNew },
  ];

  console.table(checks);

  const allMatched = checks.every(c => c.match);
  console.log(`\nALL PARITY CHECKS PASSED: ${allMatched ? 'YES (100% IDENTICAL)' : 'NO'}`);
}

runParityAndTimingAudit().catch(console.error).finally(() => prisma.$disconnect());
