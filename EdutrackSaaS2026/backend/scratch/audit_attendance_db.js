const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tableSizes = await prisma.$queryRaw`
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
      AND relname IN ('Attendance', 'AttendanceSession')
    ORDER BY pg_total_relation_size(c.oid) DESC;
  `;
  console.log('--- ACTUAL POSTGRESQL TABLE & INDEX SIZES ---');
  console.table(tableSizes);

  const rowCounts = await prisma.$queryRaw`
    SELECT 
      (SELECT COUNT(*) FROM "Attendance")::text as attendance_count,
      (SELECT COUNT(*) FROM "AttendanceSession")::text as session_count;
  `;
  console.log('--- ACTUAL ROW COUNTS ---');
  console.log(rowCounts);

  const indexes = await prisma.$queryRaw`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN ('Attendance', 'AttendanceSession')
    ORDER BY tablename, indexname;
  `;
  console.log('--- INDEX DEFINITIONS ---');
  console.log(JSON.stringify(indexes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
