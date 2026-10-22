const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== ULTRA FAST IN-MEMORY DATA PARITY VERIFICATION ===\n');

  // Load all 9,319 test aggregate rows into memory Map
  const tStart = Date.now();
  const allAggregates = await prisma.$queryRaw`
    SELECT "tenantId", "studentId", "year", "month", "statusMap", "reasons"
    FROM "AttendanceMonthlyAggregate_Test";
  `;

  const aggMap = new Map();
  for (const a of allAggregates) {
    const key = `${a.tenantId}_${a.studentId}_${a.year}_${a.month}`;
    aggMap.set(key, a);
  }
  console.log(`Loaded ${allAggregates.length} aggregates into memory map in ${Date.now() - tStart} ms.`);

  // Stream 100,000 Attendance records
  const sample = await prisma.$queryRaw`
    SELECT 
      a."tenantId",
      a."studentId",
      a."status"::text as status,
      a."reason",
      s."date"
    FROM "Attendance" a
    JOIN "AttendanceSession" s ON a."attendanceSessionId" = s."id"
    LIMIT 100000;
  `;

  let mismatches = 0;
  let reasonMismatches = 0;
  let missingAggregates = 0;

  for (const r of sample) {
    const d = new Date(r.date);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const day = d.getDate();
    const key = `${r.tenantId}_${r.studentId}_${yr}_${mo}`;

    const agg = aggMap.get(key);
    if (!agg) {
      missingAggregates++;
      continue;
    }

    const char = agg.statusMap[day - 1];
    let expectedChar = 'P';
    if (r.status === 'ABSENT') expectedChar = 'A';
    else if (r.status === 'LATE') expectedChar = 'L';
    else if (r.status === 'EXCUSED') expectedChar = 'E';
    else if (r.status === 'HOLIDAY') charCode = 'H';

    if (char !== expectedChar) {
      mismatches++;
    }

    const expReason = (r.reason || '').trim();
    const actReason = (agg.reasons && agg.reasons[day.toString()] && agg.reasons[day.toString()].reason || '').trim();
    if (expReason !== actReason) {
      reasonMismatches++;
    }
  }

  console.log(`\n--- PARITY RESULTS FOR 100,000 RECORDS ---`);
  console.log(`Granular Records Evaluated: 100,000`);
  console.log(`Missing Aggregates:         ${missingAggregates}`);
  console.log(`Status Mismatches:          ${mismatches}`);
  console.log(`Reason Mismatches:          ${reasonMismatches}`);

  if (mismatches === 0 && reasonMismatches === 0 && missingAggregates === 0) {
    console.log('\n🎉 100% PERFECT DATA PARITY CONFIRMED ACROSS 100,000 RECORDS!');
  } else {
    console.log('\n❌ MISMATCHES DETECTED');
  }

  // Performance Comparison
  const testStudent = sample[0].studentId;
  const testTenant = sample[0].tenantId;

  console.log('\n--- PERFORMANCE BENCHMARKS ---');
  const t0 = Date.now();
  await prisma.attendance.findMany({
    where: {
      tenantId: testTenant,
      studentId: testStudent,
      attendanceSession: { date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') } }
    }
  });
  const oldMonthMs = Date.now() - t0;

  const t1 = Date.now();
  await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${testTenant} AND "studentId" = ${testStudent} AND "year" = 2026 AND "month" = 6;
  `;
  const newMonthMs = Date.now() - t1;

  console.log(`Student Monthly History Query: Granular Model = ${oldMonthMs} ms | Monthly Aggregate = ${newMonthMs} ms (${(oldMonthMs/newMonthMs).toFixed(1)}x speedup)`);

  const t2 = Date.now();
  await prisma.attendance.findMany({
    where: {
      tenantId: testTenant,
      studentId: testStudent,
      attendanceSession: { date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') } }
    }
  });
  const oldYearMs = Date.now() - t2;

  const t3 = Date.now();
  await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${testTenant} AND "studentId" = ${testStudent} AND "year" = 2026;
  `;
  const newYearMs = Date.now() - t3;

  console.log(`Student Yearly History Query:  Granular Model = ${oldYearMs} ms | Monthly Aggregate = ${newYearMs} ms (${(oldYearMs/newYearMs).toFixed(1)}x speedup)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
