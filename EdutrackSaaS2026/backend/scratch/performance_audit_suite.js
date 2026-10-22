const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function runPerformanceAudit() {
  console.log('================================================================================');
  console.log('           EDUTRACK SAAS – COMPREHENSIVE PERFORMANCE AUDIT SUITE               ');
  console.log('================================================================================');

  // 1. Connection & Overview
  const t0 = Date.now();
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      subDomain: true,
      _count: {
        select: {
          studentProfiles: true,
          staffProfiles: true,
          classes: true,
          invoices: true,
        }
      }
    }
  });
  const connTime = Date.now() - t0;
  console.log(`\n[Database Ping & Tenants Scan] took: ${connTime}ms`);
  console.log(`Found ${tenants.length} tenants in database:`);
  tenants.forEach(t => {
    console.log(`  * [${t.id}] ${t.name} (${t.subDomain}) -> Students: ${t._count.studentProfiles}, Staff: ${t._count.staffProfiles}, Classes: ${t._count.classes}, Invoices: ${t._count.invoices}`);
  });

  const activeTenant = tenants.find(t => t._count.studentProfiles > 0) || tenants[0];
  if (!activeTenant) {
    console.log('No active tenant found.');
    return;
  }
  const tenantId = activeTenant.id;
  console.log(`\n>>> Auditing Primary Tenant: ${activeTenant.name} (${tenantId}) <<<\n`);

  // ============================================================================
  // AUDIT MODULE 1: DASHBOARD SUMMARY LIFECYCLE & EXECUTION TIMING
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('MODULE 1: DASHBOARD SUMMARY (Current Implementation Execution Profile)');
  console.log('--------------------------------------------------------------------------------');

  const dashStart = Date.now();

  // Step 1: Count Students
  const q1Start = Date.now();
  const studentsCount = await prisma.studentProfile.count({
    where: { user: { tenantId, isActive: true } }
  });
  const q1Time = Date.now() - q1Start;

  // Step 2: Count Teachers
  const q2Start = Date.now();
  const teachersCount = await prisma.staffProfile.count({
    where: { user: { tenantId, isActive: true, role: { in: ['TEACHER', 'STAFF'] } } }
  });
  const q2Time = Date.now() - q2Start;

  // Step 3: Count Classes
  const q3Start = Date.now();
  const classesCount = await prisma.classSection.count({
    where: { tenantId, class: { isActive: true } }
  });
  const q3Time = Date.now() - q3Start;

  // Step 4: Revenue Aggregation
  const q4Start = Date.now();
  const revenueAgg = await prisma.invoice.aggregate({
    where: { tenantId, status: 'PAID' },
    _sum: { paidAmount: true }
  });
  const q4Time = Date.now() - q4Start;

  // Step 5: Expense Aggregation
  const q5Start = Date.now();
  const expenseAgg = await prisma.expense.aggregate({
    where: { tenantId, status: 'PAID' },
    _sum: { amount: true }
  });
  const q5Time = Date.now() - q5Start;

  // Step 6: Attendance Sessions Full Table Fetch (In-memory aggregation)
  const q6Start = Date.now();
  const sessions = await prisma.attendanceSession.findMany({
    where: { tenantId },
    select: { presentCount: true, totalStudents: true }
  });
  const q6Time = Date.now() - q6Start;

  // Step 7: Exam Marks Full Table Fetch (In-memory score calculations)
  const q7Start = Date.now();
  const marks = await prisma.examMark.findMany({
    where: { tenantId },
    select: { examId: true, subjectId: true, subjectType: true, marksObtained: true }
  });
  const q7Time = Date.now() - q7Start;

  // Step 7.1: Exam Subjects for Max Marks
  const q71Start = Date.now();
  const examSubjectsConfig = await prisma.examSubject.findMany({
    where: { tenantId },
    select: { examId: true, subjectId: true, subjectType: true, maxMarks: true }
  });
  const q71Time = Date.now() - q71Start;

  // Step 7b: Leave Requests Full Fetch
  const q7bStart = Date.now();
  const leavesList = await prisma.leaveRequest.findMany({
    where: { tenantId },
    select: { status: true, approvedDate: true, rejectedDate: true }
  });
  const q7bTime = Date.now() - q7bStart;

  // Step 8: Recent Admissions
  const q8Start = Date.now();
  const recentStudents = await prisma.studentProfile.findMany({
    where: { user: { tenantId, isActive: true } },
    orderBy: { user: { createdAt: 'desc' } },
    take: 10,
    include: {
      user: true,
      classSection: {
        include: {
          class: true,
          section: true
        }
      }
    }
  });
  const q8Time = Date.now() - q8Start;

  // Step 9: Recent Invoices
  const q9Start = Date.now();
  const invoices = await prisma.invoice.findMany({
    where: { tenantId, status: 'PAID' },
    include: { student: { include: { user: true } } },
    orderBy: { invoiceDate: 'desc' },
    take: 10
  });
  const q9Time = Date.now() - q9Start;

  // Step 9b: Recent Salary Expenses
  const q9bStart = Date.now();
  const salaryExpenses = await prisma.expense.findMany({
    where: { tenantId, category: 'Salary', status: 'PAID' },
    orderBy: { date: 'desc' },
    take: 10
  });
  const q9bTime = Date.now() - q9bStart;

  // Step 10: 6-month monthly charts full table fetches
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const q10aStart = Date.now();
  const monthlyInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: 'PAID', invoiceDate: { gte: sixMonthsAgo } },
    select: { paidAmount: true, invoiceDate: true }
  });
  const q10aTime = Date.now() - q10aStart;

  const q10bStart = Date.now();
  const monthlyExpenses = await prisma.expense.findMany({
    where: { tenantId, category: 'Salary', status: 'PAID', date: { gte: sixMonthsAgo } },
    select: { amount: true, date: true }
  });
  const q10bTime = Date.now() - q10bStart;

  const dashTotalSequential = Date.now() - dashStart;

  console.log(`  Query 1 (Students Count)          : ${q1Time}ms (Count: ${studentsCount})`);
  console.log(`  Query 2 (Teachers Count)          : ${q2Time}ms (Count: ${teachersCount})`);
  console.log(`  Query 3 (Classes Count)           : ${q3Time}ms (Count: ${classesCount})`);
  console.log(`  Query 4 (Total Revenue Agg)       : ${q4Time}ms (Total: ${revenueAgg._sum.paidAmount})`);
  console.log(`  Query 5 (Total Expenses Agg)      : ${q5Time}ms (Total: ${expenseAgg._sum.amount})`);
  console.log(`  Query 6 (All Attendance Sessions) : ${q6Time}ms (Rows fetched: ${sessions.length}) -> Bottleneck: In-memory average`);
  console.log(`  Query 7 (All Exam Marks)          : ${q7Time}ms (Rows fetched: ${marks.length}) -> Bottleneck: In-memory loop`);
  console.log(`  Query 7.1 (All Exam Subjects)     : ${q71Time}ms (Rows fetched: ${examSubjectsConfig.length})`);
  console.log(`  Query 7b (All Leave Requests)     : ${q7bTime}ms (Rows fetched: ${leavesList.length})`);
  console.log(`  Query 8 (Recent Admissions 10)    : ${q8Time}ms (Include deep relations)`);
  console.log(`  Query 9 (Recent Invoices 10)      : ${q9Time}ms`);
  console.log(`  Query 9b (Recent Salaries 10)     : ${q9bTime}ms`);
  console.log(`  Query 10a (6-Mo Invoices)         : ${q10aTime}ms (Rows: ${monthlyInvoices.length})`);
  console.log(`  Query 10b (6-Mo Expenses)         : ${q10bTime}ms (Rows: ${monthlyExpenses.length})`);
  console.log(`  TOTAL SEQUENTIAL TIME FOR DASHBOARD: ${dashTotalSequential}ms (${(dashTotalSequential/1000).toFixed(2)}s)`);

  // Benchmark direct SQL aggregates vs in-memory
  const sqlAggStart = Date.now();
  const [attAggSQL, marksAggSQL, leaveAggSQL, monthlyInvoicesSQL, monthlyExpensesSQL] = await Promise.all([
    prisma.$queryRaw`
      SELECT 
        COALESCE(SUM("presentCount"), 0)::bigint AS "presentCount",
        COALESCE(SUM("totalStudents"), 0)::bigint AS "totalStudents"
      FROM "AttendanceSession"
      WHERE "tenantId" = ${tenantId}
    `,
    prisma.$queryRaw`
      SELECT 
        COALESCE(AVG(em."marksObtained"), 0)::float AS "avgMarks"
      FROM "ExamMark" em
      WHERE em."tenantId" = ${tenantId}
    `,
    prisma.$queryRaw`
      SELECT 
        status, 
        COUNT(*)::int AS count 
      FROM "LeaveRequest" 
      WHERE "tenantId" = ${tenantId} 
      GROUP BY status
    `,
    prisma.$queryRaw`
      SELECT 
        to_char("invoiceDate", 'YYYY-MM') AS "month",
        COALESCE(SUM("paidAmount"), 0)::float AS "totalPaid"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId} AND status = 'PAID' AND "invoiceDate" >= ${sixMonthsAgo}
      GROUP BY to_char("invoiceDate", 'YYYY-MM')
      ORDER BY "month" ASC
    `,
    prisma.$queryRaw`
      SELECT 
        to_char(date, 'YYYY-MM') AS "month",
        COALESCE(SUM(amount), 0)::float AS "totalAmount"
      FROM "Expense"
      WHERE "tenantId" = ${tenantId} AND category = 'Salary' AND status = 'PAID' AND date >= ${sixMonthsAgo}
      GROUP BY to_char(date, 'YYYY-MM')
      ORDER BY "month" ASC
    `
  ]);
  const sqlAggTime = Date.now() - sqlAggStart;
  console.log(`  OPTIMIZED DIRECT SQL AGGREGATES (All 5 executed in parallel): ${sqlAggTime}ms (vs in-memory ${(q6Time + q7Time + q71Time + q7bTime + q10aTime + q10bTime)}ms)`);

  // ============================================================================
  // AUDIT MODULE 2: STUDENT DIRECTORY & BILLING BATCH AUDIT
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('MODULE 2: STUDENT DIRECTORY & BILLING BATCH LIFECYCLE');
  console.log('--------------------------------------------------------------------------------');

  const studentsStart = Date.now();

  const countStart = Date.now();
  const totalStudents = await prisma.studentProfile.count({
    where: { tenantId, user: { isActive: true } }
  });
  const countTime = Date.now() - countStart;

  const pageQueryStart = Date.now();
  const pageStudents = await prisma.studentProfile.findMany({
    where: { tenantId, user: { isActive: true } },
    select: {
      id: true,
      rollNo: true,
      fatherName: true,
      motherName: true,
      fatherPhone: true,
      motherPhone: true,
      guardianPhone: true,
      aadharNo: true,
      profilePhotoUrl: true,
      classSectionId: true,
      tenantId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      },
      classSection: {
        select: {
          id: true,
          classId: true,
          sectionId: true,
          class: { select: { id: true, name: true, academicYearId: true } },
          section: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { user: { name: 'asc' } },
    take: 20,
    skip: 0
  });
  const pageQueryTime = Date.now() - pageQueryStart;

  const studentIds = pageStudents.map(s => s.id);

  // Measure getStudentsBillingInfoBatch
  const batchBillingStart = Date.now();
  const allOpps = await prisma.opportunity.findMany({
    where: { studentId: { in: studentIds }, tenantId },
    include: {
      academicYear: true,
      opportunityLineItems: { include: { product: true } },
      invoices: {
        where: { tenantId, status: { not: 'VOIDED' } },
        include: { invoiceItems: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  const oppsTime = Date.now() - batchBillingStart;

  const orphanStart = Date.now();
  const allOrphans = await prisma.invoice.findMany({
    where: {
      studentId: { in: studentIds },
      tenantId,
      opportunityId: null,
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] }
    }
  });
  const orphanTime = Date.now() - orphanStart;

  const studentsTotalTime = Date.now() - studentsStart;

  console.log(`  Count Query                      : ${countTime}ms (Total: ${totalStudents})`);
  console.log(`  Page FindMany Query (20 items)   : ${pageQueryTime}ms`);
  console.log(`  Batch Opportunities (with items) : ${oppsTime}ms (Found ${allOpps.length} opps)`);
  console.log(`  Batch Orphan Invoices            : ${orphanTime}ms (Found ${allOrphans.length} orphans)`);
  console.log(`  TOTAL TIME FOR STUDENTS PAGE API : ${studentsTotalTime}ms`);

  // ============================================================================
  // AUDIT MODULE 3: SETUP-STATUS LIFECYCLE (Called on almost every page)
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('MODULE 3: /tenant/setup-status LIFECYCLE AUDIT');
  console.log('--------------------------------------------------------------------------------');

  const setupStart = Date.now();
  const user = await prisma.user.findFirst({ where: { tenantId, role: 'SCHOOL_ADMIN' } });
  const setup = await prisma.schoolSetup.findUnique({ where: { tenantId } });
  const sc = await prisma.studentProfile.count({ where: { user: { tenantId, isActive: true } } });
  const tc = await prisma.staffProfile.count({ where: { user: { tenantId, isActive: true, role: { in: ['TEACHER', 'STAFF'] } } } });
  const cc = await prisma.classSection.count({ where: { tenantId, class: { isActive: true } } });
  const sub = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
  const setupTotalTime = Date.now() - setupStart;

  console.log(`  Sequential setup-status duration : ${setupTotalTime}ms across 6 round-trips`);

  const setupParStart = Date.now();
  const [pUser, pSetup, pSc, pTc, pCc, pSub] = await Promise.all([
    prisma.user.findFirst({ where: { tenantId, role: 'SCHOOL_ADMIN' } }),
    prisma.schoolSetup.findUnique({ where: { tenantId } }),
    prisma.studentProfile.count({ where: { user: { tenantId, isActive: true } } }),
    prisma.staffProfile.count({ where: { user: { tenantId, isActive: true, role: { in: ['TEACHER', 'STAFF'] } } } }),
    prisma.classSection.count({ where: { tenantId, class: { isActive: true } } }),
    prisma.tenantSubscription.findUnique({ where: { tenantId } })
  ]);
  const setupParTime = Date.now() - setupParStart;
  console.log(`  Parallel setup-status duration   : ${setupParTime}ms (Speedup: ${((setupTotalTime - setupParTime)/setupTotalTime * 100).toFixed(1)}%)`);

  // ============================================================================
  // AUDIT MODULE 4: ACADEMIC LOOKUPS (Classes, Sections, Academic Years)
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('MODULE 4: ACADEMIC LOOKUPS (/academics/classes, /sections, /academic-years)');
  console.log('--------------------------------------------------------------------------------');

  const lookupsStart = Date.now();
  const [ays, classes, sections] = await Promise.all([
    prisma.academicYear.findMany({ where: { tenantId }, orderBy: { startDate: 'desc' } }),
    prisma.class.findMany({ where: { tenantId, isActive: true }, include: { academicYear: true }, orderBy: { name: 'asc' } }),
    prisma.section.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  ]);
  const lookupsTime = Date.now() - lookupsStart;
  console.log(`  Lookups query time (Parallel)    : ${lookupsTime}ms (AYs: ${ays.length}, Classes: ${classes.length}, Sections: ${sections.length})`);

  // ============================================================================
  // AUDIT MODULE 5: POSTGRESQL QUERY PLANS & INDEX INSPECTION
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('MODULE 5: POSTGRESQL EXPLAIN (ANALYZE, BUFFERS) QUERY PLANS');
  console.log('--------------------------------------------------------------------------------');

  try {
    const explainStudent = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT sp.id, sp."rollNo", u.name, u.email
      FROM "StudentProfile" sp
      JOIN "User" u ON sp."userId" = u.id
      WHERE sp."tenantId" = '${tenantId}' AND u."isActive" = true
      ORDER BY u.name ASC
      LIMIT 20;
    `);
    console.log('  EXPLAIN ANALYZE for Student Directory Query:');
    explainStudent.forEach(row => console.log(`    ${row['QUERY PLAN']}`));
  } catch (err) {
    console.log('  Could not run EXPLAIN ANALYZE:', err.message);
  }

  try {
    const explainAttendance = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT ses.id, ses.date, ses."presentCount", ses."totalStudents"
      FROM "AttendanceSession" ses
      WHERE ses."tenantId" = '${tenantId}'
      ORDER BY ses.date DESC
      LIMIT 100;
    `);
    console.log('\n  EXPLAIN ANALYZE for Attendance Session Scan:');
    explainAttendance.forEach(row => console.log(`    ${row['QUERY PLAN']}`));
  } catch (err) {
    console.log('  Could not run EXPLAIN ANALYZE:', err.message);
  }

  console.log('\n================================================================================');
  console.log('                     PERFORMANCE AUDIT SUITE COMPLETE                           ');
  console.log('================================================================================\n');
}

runPerformanceAudit()
  .catch(err => {
    console.error('Audit failed with error:', err);
  })
  .finally(() => prisma.$disconnect());
