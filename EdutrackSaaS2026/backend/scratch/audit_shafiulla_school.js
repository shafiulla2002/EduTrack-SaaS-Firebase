const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function auditShafiulla() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Shafiulla High School

  console.log('================================================================================');
  console.log('AUDITING LARGEST TENANT: Shafiulla High School (2300 Students, 265 Invoices)');
  console.log('================================================================================\n');

  // 1. Dashboard queries individually measured
  console.log('--- DASHBOARD QUERIES (Individual Timings) ---');
  
  const m1Start = Date.now();
  const studentsCount = await prisma.studentProfile.count({ where: { user: { tenantId, isActive: true } } });
  console.log(`1. studentsCount: ${Date.now() - m1Start}ms (Value: ${studentsCount})`);

  const m2Start = Date.now();
  const teachersCount = await prisma.staffProfile.count({ where: { user: { tenantId, isActive: true, role: { in: ['TEACHER', 'STAFF'] } } } });
  console.log(`2. teachersCount: ${Date.now() - m2Start}ms (Value: ${teachersCount})`);

  const m3Start = Date.now();
  const classesCount = await prisma.classSection.count({ where: { tenantId, class: { isActive: true } } });
  console.log(`3. classesCount: ${Date.now() - m3Start}ms (Value: ${classesCount})`);

  const m4Start = Date.now();
  const revenueAgg = await prisma.invoice.aggregate({ where: { tenantId, status: 'PAID' }, _sum: { paidAmount: true } });
  console.log(`4. revenueAgg: ${Date.now() - m4Start}ms (Value: ${revenueAgg._sum.paidAmount})`);

  const m5Start = Date.now();
  const expenseAgg = await prisma.expense.aggregate({ where: { tenantId, status: 'PAID' }, _sum: { amount: true } });
  console.log(`5. expenseAgg: ${Date.now() - m5Start}ms (Value: ${expenseAgg._sum.amount})`);

  const m6Start = Date.now();
  const sessions = await prisma.attendanceSession.findMany({ where: { tenantId }, select: { presentCount: true, totalStudents: true } });
  console.log(`6. attendanceSessions (Full Table): ${Date.now() - m6Start}ms (Rows: ${sessions.length})`);

  const m7Start = Date.now();
  const marks = await prisma.examMark.findMany({ where: { tenantId }, select: { examId: true, subjectId: true, subjectType: true, marksObtained: true } });
  console.log(`7. examMarks (Full Table): ${Date.now() - m7Start}ms (Rows: ${marks.length})`);

  const m8Start = Date.now();
  const recentStudents = await prisma.studentProfile.findMany({
    where: { user: { tenantId, isActive: true } },
    orderBy: { user: { createdAt: 'desc' } },
    take: 10,
    include: { user: true, classSection: { include: { class: true, section: true } } }
  });
  console.log(`8. recentAdmissions (Deep Include): ${Date.now() - m8Start}ms (Rows: ${recentStudents.length})`);

  const m9Start = Date.now();
  const recentInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: 'PAID' },
    include: { student: { include: { user: true } } },
    orderBy: { invoiceDate: 'desc' },
    take: 10
  });
  console.log(`9. recentInvoices: ${Date.now() - m9Start}ms (Rows: ${recentInvoices.length})`);

  // 2. Student directory timing
  console.log('\n--- STUDENT DIRECTORY QUERIES ---');
  const s1Start = Date.now();
  const total = await prisma.studentProfile.count({ where: { tenantId, user: { isActive: true } } });
  console.log(`1. totalStudentsCount: ${Date.now() - s1Start}ms (Total: ${total})`);

  const s2Start = Date.now();
  const studentsList = await prisma.studentProfile.findMany({
    where: { tenantId, user: { isActive: true } },
    select: {
      id: true,
      rollNo: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
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
    take: 20
  });
  console.log(`2. studentsPage20: ${Date.now() - s2Start}ms (Rows: ${studentsList.length})`);

  const studentIds = studentsList.map(s => s.id);
  const s3Start = Date.now();
  const opps = await prisma.opportunity.findMany({
    where: { studentId: { in: studentIds }, tenantId },
    include: {
      academicYear: true,
      opportunityLineItems: { include: { product: true } },
      invoices: { where: { tenantId, status: { not: 'VOIDED' } }, include: { invoiceItems: true } }
    }
  });
  console.log(`3. opportunitiesBatch: ${Date.now() - s3Start}ms (Opps: ${opps.length})`);

  // 3. Optimized Raw SQL Aggregate timings
  console.log('\n--- DIRECT SQL AGGREGATE ALTERNATIVES ---');
  const sql1Start = Date.now();
  const [attSQL] = await prisma.$queryRaw`
    SELECT 
      COALESCE(SUM("presentCount"), 0)::bigint AS "presentCount",
      COALESCE(SUM("totalStudents"), 0)::bigint AS "totalStudents"
    FROM "AttendanceSession"
    WHERE "tenantId" = ${tenantId}
  `;
  console.log(`1. Attendance Direct SQL SUM: ${Date.now() - sql1Start}ms (present: ${attSQL.presentCount}, total: ${attSQL.totalStudents})`);

  const sql2Start = Date.now();
  const [marksSQL] = await prisma.$queryRaw`
    SELECT 
      COALESCE(AVG("marksObtained"), 0)::float AS "avgMarks"
    FROM "ExamMark"
    WHERE "tenantId" = ${tenantId}
  `;
  console.log(`2. Exam Marks Direct SQL AVG: ${Date.now() - sql2Start}ms (avg: ${marksSQL.avgMarks})`);

  const sql3Start = Date.now();
  const leavesSQL = await prisma.$queryRaw`
    SELECT status, COUNT(*)::int AS count
    FROM "LeaveRequest"
    WHERE "tenantId" = ${tenantId}
    GROUP BY status
  `;
  console.log(`3. Leave Requests Direct SQL GROUP BY: ${Date.now() - sql3Start}ms (groups: ${leavesSQL.length})`);

  console.log('\n================================================================================');
  console.log('AUDIT COMPLETED SUCCESSFULLY');
  console.log('================================================================================');
}

auditShafiulla().catch(console.error).finally(() => prisma.$disconnect());
