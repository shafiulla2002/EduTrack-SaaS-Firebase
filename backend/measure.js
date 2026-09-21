const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tenantId = process.env.BENCHMARK_TENANT_ID || '51900d01-1e46-4f36-9625-9759285d5f64'; // Target school tenant with active benchmark data

async function measureQuery(label, queryFn) {
  const start = performance.now();
  const result = await queryFn();
  const duration = performance.now() - start;
  return { duration, result };
}

async function run() {
  console.log('--- STARTING PERFORMANCE BASELINE MEASUREMENTS ---');
  const report = {};

  // 1. Dashboard Summary measurements
  console.log('Measuring: Dashboard Summary...');
  const dbStart = performance.now();
  
  // Measure individual sequential queries
  const q1 = await measureQuery('Students Count', () => prisma.studentProfile.count({
    where: { user: { tenantId, isActive: true } }
  }));
  const q2 = await measureQuery('Teachers Count', () => prisma.staffProfile.count({
    where: { user: { tenantId, isActive: true, role: 'TEACHER' } }
  }));
  const q3 = await measureQuery('Classes Count', () => prisma.class.count({
    where: { tenantId, isActive: true }
  }));
  const q4 = await measureQuery('Total Revenue', () => prisma.invoice.aggregate({
    where: { tenantId, status: 'PAID' },
    _sum: { paidAmount: true }
  }));
  const q5 = await measureQuery('Total Expenses', () => prisma.expense.aggregate({
    where: { tenantId, status: 'PAID' },
    _sum: { amount: true }
  }));
  const q6 = await measureQuery('Attendance Sessions', () => prisma.attendanceSession.findMany({
    where: { tenantId },
    select: { presentCount: true, totalStudents: true }
  }));
  const q7 = await measureQuery('Exam Marks', () => prisma.examMark.findMany({
    where: { tenantId },
    select: { marksObtained: true }
  }));
  const q8 = await measureQuery('Recent Students', () => prisma.studentProfile.findMany({
    where: { user: { tenantId, isActive: true } },
    orderBy: { user: { createdAt: 'desc' } },
    take: 10,
    include: {
      user: true,
      classSection: { include: { class: true, section: true } }
    }
  }));
  const q9 = await measureQuery('Invoices', () => prisma.invoice.findMany({
    where: { tenantId, status: 'PAID' },
    include: { student: { include: { user: true } } },
    orderBy: { invoiceDate: 'desc' },
    take: 10
  }));
  const q10 = await measureQuery('Salary Expenses', () => prisma.expense.findMany({
    where: { tenantId, category: 'Salary', status: 'PAID' },
    orderBy: { date: 'desc' },
    take: 10
  }));

  // 6 months aggregation loops (12 queries)
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6Months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleString('default', { month: 'short', year: 'numeric' })
    });
  }

  const loopStart = performance.now();
  let loopQueryTime = 0;
  for (const m of last6Months) {
    const startDate = new Date(m.year, m.month, 1);
    const endDate = new Date(m.year, m.month + 1, 0, 23, 59, 59, 999);
    
    const mf = await measureQuery('Month Fees', () => prisma.invoice.aggregate({
      where: { tenantId, status: 'PAID', invoiceDate: { gte: startDate, lte: endDate } },
      _sum: { paidAmount: true }
    }));
    const ms = await measureQuery('Month Salaries', () => prisma.expense.aggregate({
      where: { tenantId, category: 'Salary', status: 'PAID', date: { gte: startDate, lte: endDate } },
      _sum: { amount: true }
    }));
    loopQueryTime += mf.duration + ms.duration;
  }
  const loopDuration = performance.now() - loopStart;

  // Trends queries (4 queries)
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const t1 = await measureQuery('Trend Stu This Month', () => prisma.studentProfile.count({
    where: { user: { tenantId, isActive: true, createdAt: { gte: thisMonthStart } } }
  }));
  const t2 = await measureQuery('Trend Stu Last Month', () => prisma.studentProfile.count({
    where: { user: { tenantId, isActive: true, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }
  }));
  const t3 = await measureQuery('Trend Rev This Month', () => prisma.invoice.aggregate({
    where: { tenantId, status: 'PAID', invoiceDate: { gte: thisMonthStart } },
    _sum: { paidAmount: true }
  }));
  const t4 = await measureQuery('Trend Rev Last Month', () => prisma.invoice.aggregate({
    where: { tenantId, status: 'PAID', invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd } },
    _sum: { paidAmount: true }
  }));

  const dbEnd = performance.now();
  const totalDbQueriesTime = 
    q1.duration + q2.duration + q3.duration + q4.duration + q5.duration + 
    q6.duration + q7.duration + q8.duration + q9.duration + q10.duration + 
    loopQueryTime + t1.duration + t2.duration + t3.duration + t4.duration;
  const totalDashboardDuration = dbEnd - dbStart;

  report.dashboard = {
    queriesCount: 26,
    dbQueryTimeMs: totalDbQueriesTime,
    serviceExecutionTimeMs: totalDashboardDuration - totalDbQueriesTime,
    totalResponseTimeMs: totalDashboardDuration,
    individualTimings: {
      studentsCount: q1.duration,
      teachersCount: q2.duration,
      classesCount: q3.duration,
      totalRevenue: q4.duration,
      totalExpenses: q5.duration,
      attendanceRate: q6.duration,
      academicAverage: q7.duration,
      recentAdmissions: q8.duration,
      recentInvoices: q9.duration,
      recentSalaries: q10.duration,
      loop6MonthsAggregate: loopDuration,
      trends: t1.duration + t2.duration + t3.duration + t4.duration
    }
  };

  // 2. Students List measurements
  console.log('Measuring: Students List...');
  const studStart = performance.now();
  const studQuery = await measureQuery('Students List Query', () => prisma.studentProfile.findMany({
    where: { user: { tenantId, isActive: true } },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      classSection: { include: { class: true, section: true } },
      invoices: { where: { tenantId }, select: { remainingBalance: true, paidAmount: true } }
    },
    orderBy: { user: { name: 'asc' } },
    take: 200
  }));
  const studEnd = performance.now();
  report.students = {
    queriesCount: 1,
    dbQueryTimeMs: studQuery.duration,
    serviceExecutionTimeMs: (studEnd - studStart) - studQuery.duration,
    totalResponseTimeMs: studEnd - studStart
  };

  // 3. Teachers List measurements
  console.log('Measuring: Teachers List...');
  const teachStart = performance.now();
  const teachQuery = await measureQuery('Teachers List Query', () => prisma.staffProfile.findMany({
    where: { user: { tenantId, role: { in: ['TEACHER', 'STAFF'] }, isActive: true } },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      _count: { select: { teacherAssignments: true } }
    },
    orderBy: { user: { name: 'asc' } }
  }));
  const teachEnd = performance.now();
  report.teachers = {
    queriesCount: 1,
    dbQueryTimeMs: teachQuery.duration,
    serviceExecutionTimeMs: (teachEnd - teachStart) - teachQuery.duration,
    totalResponseTimeMs: teachEnd - teachStart
  };

  // 4. Attendance measurements
  console.log('Measuring: Attendance Recent...');
  const attStart = performance.now();
  const attQuery1 = await measureQuery('Recent Submissions', () => prisma.attendanceSession.findMany({
    where: { tenantId },
    include: {
      classSection: { include: { class: true, section: true } },
      takenBy: { include: { user: { select: { name: true } } } }
    },
    orderBy: { date: 'desc' },
    take: 10
  }));
  const attQuery2 = await measureQuery('Daily Summary', () => prisma.attendanceSession.findMany({
    where: { tenantId, date: new Date() },
    select: { id: true, totalStudents: true, presentCount: true, absentCount: true }
  }));
  const attEnd = performance.now();
  report.attendance = {
    queriesCount: 2,
    dbQueryTimeMs: attQuery1.duration + attQuery2.duration,
    serviceExecutionTimeMs: (attEnd - attStart) - (attQuery1.duration + attQuery2.duration),
    totalResponseTimeMs: attEnd - attStart
  };

  // 5. Billing Search Student measurements (N+1 Query)
  console.log('Measuring: Billing searchStudents (N+1 scenario)...');
  const billSearchStart = performance.now();
  
  // Find up to 20 students
  const billStudentsQuery = await measureQuery('Billing search base', () => prisma.studentProfile.findMany({
    where: { user: { tenantId } },
    include: {
      user: true,
      classSection: { include: { class: true, section: true } },
      opportunities: {
        where: { stageName: { notIn: ['Closed Won', 'Closed Lost'] } },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    take: 20
  }));

  let nPlusOneTime = 0;
  const loopResults = [];
  for (const student of billStudentsQuery.result) {
    const openOpp = student.opportunities[0];
    if (openOpp) {
      const olis = await measureQuery('OLI query', () => prisma.opportunityLineItem.findMany({
        where: { opportunityId: openOpp.id, tenantId }
      }));
      const invs = await measureQuery('InvoiceItems query', () => prisma.invoiceItem.findMany({
        where: {
          tenantId,
          invoice: { opportunityId: openOpp.id, status: { not: 'VOIDED' } }
        }
      }));
      nPlusOneTime += olis.duration + invs.duration;
    }
  }

  const billSearchEnd = performance.now();
  report.billingSearch = {
    queriesCount: 1 + (billStudentsQuery.result.filter(s => s.opportunities[0]).length * 2),
    dbQueryTimeMs: billStudentsQuery.duration + nPlusOneTime,
    serviceExecutionTimeMs: (billSearchEnd - billSearchStart) - (billStudentsQuery.duration + nPlusOneTime),
    totalResponseTimeMs: billSearchEnd - billSearchStart
  };

  // 6. Library Books measurements
  console.log('Measuring: Library Books...');
  const libStart = performance.now();
  const libQuery = await measureQuery('Library Books Query', () => prisma.book.findMany({
    where: { tenantId },
    include: { copies: true },
    orderBy: { title: 'asc' }
  }));
  const libEnd = performance.now();
  report.library = {
    queriesCount: 1,
    dbQueryTimeMs: libQuery.duration,
    serviceExecutionTimeMs: (libEnd - libStart) - libQuery.duration,
    totalResponseTimeMs: libEnd - libStart
  };

  // 7. Reports (Grades Report) measurements
  console.log('Measuring: Grades Report...');
  const repStart = performance.now();
  
  // Find a class section to generate report
  const classSec = await prisma.classSection.findFirst({ where: { tenantId } });
  let repQuery1 = { duration: 0 }, repQuery2 = { duration: 0 };
  if (classSec) {
    const exam = await prisma.exam.findFirst({ where: { tenantId, classSectionId: classSec.id } });
    if (exam) {
      repQuery1 = await measureQuery('Grades Report Exam', () => prisma.exam.findFirst({
        where: { tenantId, classSectionId: classSec.id, name: exam.name }
      }));
      repQuery2 = await measureQuery('Grades Report Marks', () => prisma.examMark.findMany({
        where: { tenantId, examId: exam.id },
        include: {
          student: { include: { user: { select: { name: true } } } },
          subject: true
        }
      }));
    }
  }
  const repEnd = performance.now();
  report.reports = {
    queriesCount: classSec ? 2 : 0,
    dbQueryTimeMs: repQuery1.duration + repQuery2.duration,
    serviceExecutionTimeMs: (repEnd - repStart) - (repQuery1.duration + repQuery2.duration),
    totalResponseTimeMs: repEnd - repStart
  };

  console.log('\n--- PERFORMANCE BASELINE METRICS ---');
  console.log(JSON.stringify(report, null, 2));

  // Write file
  await prisma.$disconnect();
}

run().catch(console.error);
