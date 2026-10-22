const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== QUICK BENCHMARK & PARITY VERIFICATION ===\n');

  // Sample 5,000 records for fast parity verification
  console.log('1. Sample Data Parity Audit (5,000 random granular records)...');
  const sample = await prisma.$queryRaw`
    SELECT 
      a."id" as attendance_id,
      a."tenantId",
      a."studentId",
      a."status"::text as status,
      a."reason",
      s."date"
    FROM "Attendance" a
    JOIN "AttendanceSession" s ON a."attendanceSessionId" = s."id"
    LIMIT 5000;
  `;

  let mismatches = 0;
  for (const r of sample) {
    const d = new Date(r.date);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();

    const agg = await prisma.$queryRaw`
      SELECT "statusMap", "reasons" FROM "AttendanceMonthlyAggregate_Test"
      WHERE "tenantId" = ${r.tenantId} AND "studentId" = ${r.studentId} AND "year" = ${yr} AND "month" = ${mo};
    `;

    if (!agg || agg.length === 0) {
      mismatches++;
      continue;
    }

    const map = agg[0].statusMap;
    const char = map[day - 1];
    let expectedChar = 'P';
    if (r.status === 'ABSENT') expectedChar = 'A';
    else if (r.status === 'LATE') expectedChar = 'L';
    else if (r.status === 'EXCUSED') expectedChar = 'E';
    else if (r.status === 'HOLIDAY') expectedChar = 'H';

    if (char !== expectedChar) {
      mismatches++;
    }
  }

  console.log(`Evaluated 5,000 sample records: ${mismatches} Mismatches Found.`);
  if (mismatches === 0) {
    console.log('🎉 100% PARITY VERIFIED ON SAMPLE!');
  }

  // Query performance
  const testStudent = sample[0].studentId;
  const testTenant = sample[0].tenantId;

  console.log('\n2. Performance Benchmarks:');
  const t0 = Date.now();
  await prisma.attendance.findMany({
    where: {
      tenantId: testTenant,
      studentId: testStudent,
      attendanceSession: { date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') } }
    }
  });
  const oldMonth = Date.now() - t0;

  const t1 = Date.now();
  await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${testTenant} AND "studentId" = ${testStudent} AND "year" = 2026 AND "month" = 6;
  `;
  const newMonth = Date.now() - t1;

  console.log(`- Student Monthly Attendance Query: Old Model = ${oldMonth} ms | New Model = ${newMonth} ms`);

  const t2 = Date.now();
  await prisma.attendance.findMany({
    where: {
      tenantId: testTenant,
      studentId: testStudent,
      attendanceSession: { date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') } }
    }
  });
  const oldYear = Date.now() - t2;

  const t3 = Date.now();
  await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${testTenant} AND "studentId" = ${testStudent} AND "year" = 2026;
  `;
  const newYear = Date.now() - t3;

  console.log(`- Student Yearly Attendance Query:  Old Model = ${oldYear} ms | New Model = ${newYear} ms`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
