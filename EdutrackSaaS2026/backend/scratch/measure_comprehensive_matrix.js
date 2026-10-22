const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Priyadarshini English Medium High School
const teacherUserId = '9c32f831-2917-48ff-8a39-d3e52eeffcfa';
const parentUserId = '4afac1ca-11b6-4776-a2a4-ad407cf061b1';

async function measure(label, fn) {
  const start = performance.now();
  let res;
  try {
    res = await fn();
  } catch (err) {
    res = { error: err.message };
  }
  const duration = performance.now() - start;
  return { label, duration: Math.round(duration * 10) / 10, resultCount: Array.isArray(res) ? res.length : (res ? 1 : 0) };
}

async function run() {
  console.log('=== MEASURING COMPREHENSIVE PERFORMANCE MATRIX ===\n');
  const results = [];

  // 1. Auth & Setup
  results.push(await measure('GET /tenant/public-branding', () => prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, subtitle: true, logoUrl: true, subDomain: true }
  })));

  results.push(await measure('GET /tenant/setup-status (Single)', () => Promise.all([
    prisma.schoolSetup.findUnique({ where: { tenantId } }),
    prisma.classSection.count({ where: { tenantId, class: { isActive: true } } }),
    prisma.staffProfile.count({ where: { user: { tenantId, isActive: true } } }),
    prisma.studentProfile.count({ where: { user: { tenantId, isActive: true } } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ])));

  // 2. Dashboard
  results.push(await measure('GET /dashboard/summary (Raw Unified Query)', () => prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsCount",
      (SELECT COUNT(*)::int FROM "StaffProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true AND u.role::text IN ('TEACHER', 'STAFF')) AS "teachersCount",
      (SELECT COUNT(*)::int FROM "ClassSection" cs JOIN "Class" c ON cs."classId" = c.id WHERE cs."tenantId" = ${tenantId} AND c."isActive" = true) AS "classesCount",
      (SELECT COALESCE(SUM("paidAmount"), 0)::float FROM "Invoice" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "totalRevenue",
      (SELECT COALESCE(SUM("amount"), 0)::float FROM "Expense" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "totalExpenses"
  `));

  // 3. Students
  results.push(await measure('GET /students (Page 1, 20 items)', () => prisma.studentProfile.findMany({
    where: { user: { tenantId, isActive: true } },
    select: {
      id: true, rollNo: true, fatherName: true, motherName: true, aadharNo: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
      classSection: { select: { id: true, class: { select: { name: true } }, section: { select: { name: true } } } }
    },
    orderBy: { user: { name: 'asc' } },
    take: 20
  })));

  results.push(await measure('GET /students/promotion-candidates', () => prisma.studentProfile.findMany({
    where: { tenantId, user: { isActive: true } },
    select: { id: true, rollNo: true, user: { select: { name: true } } },
    take: 50
  })));

  // 4. Teachers & Staff
  results.push(await measure('GET /teachers (getTeachingStaff)', () => prisma.staffProfile.findMany({
    where: { user: { tenantId, role: 'TEACHER', isActive: true } },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      _count: { select: { teacherAssignments: true } }
    }
  })));

  results.push(await measure('GET /dashboard/staff (all staff with skills)', () => prisma.staffProfile.findMany({
    where: { user: { tenantId, isActive: true } },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      teacherSkills: { include: { subject: { select: { id: true, name: true } } } },
      _count: { select: { teacherAssignments: true } }
    }
  })));

  // 5. Attendance
  results.push(await measure('GET /attendance/history (100 sessions)', () => prisma.attendanceSession.findMany({
    where: { tenantId },
    select: {
      id: true, date: true, presentCount: true, absentCount: true, totalStudents: true,
      classSection: { select: { class: { select: { name: true } }, section: { select: { name: true } } } },
      takenBy: { select: { user: { select: { name: true } } } }
    },
    orderBy: { date: 'desc' },
    take: 100
  })));

  results.push(await measure('GET /attendance/students (Roster lookup)', () => prisma.studentProfile.findMany({
    where: { tenantId },
    take: 40,
    select: { id: true, rollNo: true, user: { select: { name: true } } }
  })));

  // 6. Billing
  results.push(await measure('GET /billing/summary', () => Promise.all([
    prisma.invoice.count({ where: { tenantId } }),
    prisma.invoice.aggregate({ where: { tenantId, status: { not: 'VOIDED' } }, _sum: { paidAmount: true } }),
    prisma.invoice.aggregate({ where: { tenantId, status: { in: ['UNPAID', 'PARTIALLY_PAID'] } }, _sum: { remainingBalance: true } }),
  ])));

  results.push(await measure('GET /billing/search (Single student due check)', () => prisma.studentProfile.findMany({
    where: { user: { tenantId, isActive: true, name: { contains: 'a', mode: 'insensitive' } } },
    take: 20,
    select: { id: true, rollNo: true, user: { select: { name: true } } }
  })));

  // 7. Exams & Marks
  results.push(await measure('GET /exams (List all exams)', () => prisma.exam.findMany({
    where: { tenantId },
    include: { classSection: { include: { class: true, section: true } } },
    orderBy: { date: 'desc' },
    take: 20
  })));

  results.push(await measure('GET /exams/marks-entry (Roster + Marks query)', () => Promise.all([
    prisma.studentProfile.findMany({ where: { tenantId }, take: 40, select: { id: true, rollNo: true, user: { select: { name: true } } } }),
    prisma.examMark.findMany({ where: { tenantId }, take: 40 })
  ])));

  // 8. Complaints & Leaves
  results.push(await measure('GET /complaint-box/parent-complaints', () => prisma.complaint.findMany({
    where: { tenantId },
    include: { submittedBy: { select: { name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20
  })));

  results.push(await measure('GET /leave-mgmt/requests', () => prisma.leaveRequest.findMany({
    where: { tenantId },
    include: { teacher: { include: { user: true } }, student: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20
  })));

  // 9. Expenses & Library & Salary
  results.push(await measure('GET /expenses', () => prisma.expense.findMany({
    where: { tenantId },
    orderBy: { date: 'desc' },
    take: 50
  })));

  results.push(await measure('GET /library/books', () => prisma.book.findMany({
    where: { tenantId },
    include: { copies: true },
    take: 50
  })));

  results.push(await measure('GET /timetable/workload', () => prisma.period.findMany({
    where: { tenantId },
    take: 50
  })));

  console.log(JSON.stringify(results, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
