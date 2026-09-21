const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { DashboardService } = require('./dist/src/dashboard/dashboard.service');
const { StudentsService } = require('./dist/src/students/students.service');
const { TeachersService } = require('./dist/src/teachers/teachers.service');
const { AttendanceService } = require('./dist/src/attendance/attendance.service');
const { BillingService } = require('./dist/src/billing/billing.service');
const { LibraryService } = require('./dist/src/library/library.service');
const { ExamsService } = require('./dist/src/exams/exams.service');
const { TenantContext } = require('./dist/src/tenants/tenant.context');

const tenantId = process.env.BENCHMARK_TENANT_ID || '51900d01-1e46-4f36-9625-9759285d5f64'; // Target school tenant for benchmarks

// Instantiate services
const dashboardService = new DashboardService(prisma);
const studentsService = new StudentsService(prisma);
const teachersService = new TeachersService(prisma);
const attendanceService = new AttendanceService(prisma);
const billingService = new BillingService(prisma);
const libraryService = new LibraryService(prisma);
const examsService = new ExamsService(prisma);

async function runService(label, fn) {
  const start = performance.now();
  let result;
  await new Promise((resolve, reject) => {
    TenantContext.run(tenantId, async () => {
      try {
        result = await fn();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
  const duration = performance.now() - start;
  return { duration, result };
}

async function main() {
  console.log('--- STARTING OPTIMIZED SERVICE TIMING MEASUREMENTS ---');
  const report = {};

  try {
    // 1. Dashboard Summary (Target: < 1 second)
    console.log('Measuring: Dashboard Summary...');
    const dbRes = await runService('Dashboard Summary', () => dashboardService.getDashboardSummary());
    report.dashboard = {
      totalTimeMs: dbRes.duration,
      status: dbRes.duration < 1000 ? 'PASS (Target < 1000ms)' : 'FAIL'
    };

    // 2. Students List (Target: < 500ms)
    console.log('Measuring: Students List...');
    const studRes = await runService('Students List', () => studentsService.searchStudents(undefined, undefined, undefined, 1, 20));
    report.students = {
      totalTimeMs: studRes.duration,
      status: studRes.duration < 500 ? 'PASS (Target < 500ms)' : 'FAIL',
      count: studRes.result.length
    };

    // 3. Teachers List (Target: < 500ms)
    console.log('Measuring: Teachers List...');
    const teachRes = await runService('Teachers List', () => teachersService.getTeachers());
    report.teachers = {
      totalTimeMs: teachRes.duration,
      status: teachRes.duration < 500 ? 'PASS (Target < 500ms)' : 'FAIL',
      count: teachRes.result.length
    };

    // 4. Attendance Submissions (Target: < 500ms)
    console.log('Measuring: Attendance Recent...');
    const attRes = await runService('Attendance Recent', () => attendanceService.getRecentSubmissions());
    report.attendance = {
      totalTimeMs: attRes.duration,
      status: attRes.duration < 500 ? 'PASS (Target < 500ms)' : 'FAIL',
      count: attRes.result.length
    };

    // 5. Billing Search Student (Target: < 500ms)
    console.log('Measuring: Billing searchStudents...');
    const billRes = await runService('Billing Search Student', () => billingService.searchStudents('a'));
    report.billingSearch = {
      totalTimeMs: billRes.duration,
      status: billRes.duration < 500 ? 'PASS (Target < 500ms)' : 'FAIL',
      count: billRes.result.length
    };

    // 6. Library Books (Target: < 500ms)
    console.log('Measuring: Library Books...');
    const libRes = await runService('Library Books', () => libraryService.getBooks());
    report.library = {
      totalTimeMs: libRes.duration,
      status: libRes.duration < 500 ? 'PASS (Target < 500ms)' : 'FAIL',
      count: libRes.result.length
    };

    // 7. Reports (Grades Report) (Target: < 500ms)
    console.log('Measuring: Grades Report...');
    let repRes = { duration: 0, result: [] };
    const classSec = await prisma.classSection.findFirst({ where: { tenantId } });
    if (classSec) {
      const exam = await prisma.exam.findFirst({ where: { tenantId, classSectionId: classSec.id } });
      if (exam) {
        repRes = await runService('Grades Report', () => examsService.getGradesReport(classSec.id, exam.name));
      }
    }
    report.reports = {
      totalTimeMs: repRes.duration,
      status: repRes.duration < 500 ? 'PASS (Target < 500ms)' : 'FAIL',
      count: repRes.result.length
    };

    console.log('\n--- PERFORMANCE OPTIMIZATION SUMMARY ---');
    console.log(JSON.stringify(report, null, 2));

  } catch (err) {
    console.error('Measurement error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
