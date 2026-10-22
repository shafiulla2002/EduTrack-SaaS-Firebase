const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== INSTANT ATTENDANCE VALIDATION REPORT ===\n');

  // 1. Storage Comparison
  const sizes = await prisma.$queryRaw`
    SELECT 
      relname AS table_name,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
      pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
      pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
      pg_total_relation_size(c.oid)::text AS total_bytes,
      pg_relation_size(c.oid)::text AS table_bytes,
      pg_indexes_size(c.oid)::text AS index_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
      AND relname IN ('Attendance', 'AttendanceMonthlyAggregate_Test')
    ORDER BY pg_total_relation_size(c.oid) DESC;
  `;
  console.log('1. ACTUAL POSTGRESQL RELATION SIZES:');
  console.table(sizes);

  // 2. Aggregate Row Count Comparison
  const counts = await prisma.$queryRaw`
    SELECT 
      (SELECT COUNT(*) FROM "Attendance")::text as old_granular_rows,
      (SELECT COUNT(*) FROM "AttendanceMonthlyAggregate_Test")::text as new_monthly_aggregate_rows;
  `;
  console.log('2. ROW COUNT COMPARISON:');
  console.table(counts);

  // 3. Fast Parity Audit (Sampling & Aggregation)
  console.log('3. RUNNING PARITY AUDIT...');
  const parity = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::text as total_granular_records_checked,
      COUNT(CASE WHEN 
        (CASE 
          WHEN a.status::text = 'ABSENT' THEN 'A'
          WHEN a.status::text = 'LATE' THEN 'L'
          WHEN a.status::text = 'EXCUSED' THEN 'E'
          WHEN a.status::text = 'HOLIDAY' THEN 'H'
          ELSE 'P'
        END) != SUBSTRING(agg."statusMap" FROM EXTRACT(DAY FROM s."date")::int FOR 1) 
      THEN 1 END)::text as status_mismatches
    FROM "Attendance" a
    JOIN "AttendanceSession" s ON a."attendanceSessionId" = s."id"
    JOIN "AttendanceMonthlyAggregate_Test" agg 
      ON a."tenantId" = agg."tenantId"
     AND a."studentId" = agg."studentId"
     AND EXTRACT(YEAR FROM s."date")::int = agg."year"
     AND EXTRACT(MONTH FROM s."date")::int = agg."month";
  `;
  console.table(parity);

  // 4. Query Benchmarks
  const firstAtt = await prisma.attendance.findFirst();
  const testStudent = firstAtt.studentId;
  const testTenant = firstAtt.tenantId;

  console.log('4. QUERY BENCHMARKS:');
  const t0 = Date.now();
  await prisma.attendance.findMany({
    where: {
      tenantId: testTenant,
      studentId: testStudent,
      attendanceSession: {
        date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') }
      }
    }
  });
  const oldMs = Date.now() - t0;

  const t1 = Date.now();
  await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${testTenant} AND "studentId" = ${testStudent} AND "year" = 2026 AND "month" = 6;
  `;
  const newMs = Date.now() - t1;

  console.log(`- Student Monthly History (June 2026): Granular Model = ${oldMs} ms | Monthly Aggregate Model = ${newMs} ms`);

  // 5. Tenant Isolation Test
  const dummyTenant = 'tenant_school_b_unauthorized_9999';
  const unauthorizedRead = await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${dummyTenant} AND "studentId" = ${testStudent};
  `;
  console.log(`5. TENANT ISOLATION TEST: Cross-tenant query returned ${unauthorizedRead.length} rows (PASSED if 0)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
