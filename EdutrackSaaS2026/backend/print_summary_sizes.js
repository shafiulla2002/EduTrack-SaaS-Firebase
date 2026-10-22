const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::text AS total_rows,
      pg_size_pretty(pg_relation_size('"ExamMark"')) AS table_size,
      pg_relation_size('"ExamMark"')::text AS table_size_bytes,
      pg_size_pretty(pg_indexes_size('"ExamMark"')) AS index_size,
      pg_indexes_size('"ExamMark"')::text AS index_size_bytes,
      pg_size_pretty(pg_total_relation_size('"ExamMark"')) AS total_size,
      pg_total_relation_size('"ExamMark"')::text AS total_size_bytes,
      ROUND(pg_relation_size('"ExamMark"')::numeric / NULLIF(count(*), 0), 2)::text AS avg_table_row_bytes,
      ROUND(pg_total_relation_size('"ExamMark"')::numeric / NULLIF(count(*), 0), 2)::text AS avg_total_row_bytes
    FROM "ExamMark";
  `);
  console.log('--- SUMMARY SIZES ---');
  console.log(res);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
