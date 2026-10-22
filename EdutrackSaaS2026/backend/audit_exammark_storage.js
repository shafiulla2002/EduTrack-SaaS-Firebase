const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING POSTGRESQL STORAGE AUDIT FOR ExamMark ===\n');

  // 1. Overall Table & Index Sizes
  const sizeSummary = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::text AS total_rows,
      pg_size_pretty(pg_relation_size('"ExamMark"')) AS table_size,
      pg_relation_size('"ExamMark"') AS table_size_bytes,
      pg_size_pretty(pg_indexes_size('"ExamMark"')) AS index_size,
      pg_indexes_size('"ExamMark"') AS index_size_bytes,
      pg_size_pretty(pg_total_relation_size('"ExamMark"')) AS total_size,
      pg_total_relation_size('"ExamMark"') AS total_size_bytes
    FROM "ExamMark";
  `);
  console.log('--- 1. OVERALL TABLE & INDEX SIZES ---');
  console.table(sizeSummary);

  // 2. Individual Index Sizes & Definitions
  const indexDetails = await prisma.$queryRawUnsafe(`
    SELECT
      i.relname AS index_name,
      pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
      pg_relation_size(i.oid) AS index_size_bytes,
      idx.indisunique AS is_unique,
      idx.indisprimary AS is_primary,
      pg_get_indexdef(i.oid) AS index_definition
    FROM pg_class t
    JOIN pg_index idx ON t.oid = idx.indrelid
    JOIN pg_class i ON i.oid = idx.indexrelid
    WHERE t.relname = 'ExamMark'
    ORDER BY pg_relation_size(i.oid) DESC;
  `);
  console.log('\n--- 2. INDIVIDUAL INDEX SIZES ---');
  console.table(indexDetails);

  // 3. PostgreSQL Column Schema & Types
  const columnTypes = await prisma.$queryRawUnsafe(`
    SELECT 
      column_name, 
      data_type, 
      character_maximum_length, 
      numeric_precision, 
      numeric_scale,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ExamMark'
    ORDER BY ordinal_position;
  `);
  console.log('\n--- 3. COLUMN SCHEMA & DATA TYPES ---');
  console.table(columnTypes);

  // 4. Remarks Statistics
  const remarksStats = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::text AS total_rows,
      COUNT("remarks")::text AS rows_with_remarks,
      (COUNT(*) - COUNT("remarks"))::text AS rows_null_remarks,
      ROUND(100.0 * COUNT("remarks") / NULLIF(COUNT(*), 0), 2)::text AS pct_with_remarks,
      ROUND(100.0 * (COUNT(*) - COUNT("remarks")) / NULLIF(COUNT(*), 0), 2)::text AS pct_null_remarks,
      COALESCE(AVG(LENGTH("remarks")), 0)::text AS avg_remark_length,
      COALESCE(MAX(LENGTH("remarks")), 0)::text AS max_remark_length,
      COALESCE(MIN(LENGTH("remarks")), 0)::text AS min_remark_length
    FROM "ExamMark";
  `);
  console.log('\n--- 4. REMARKS COLUMN STATISTICS ---');
  console.table(remarksStats);

  // 5. SubjectType Cardinality & Distribution
  const subjectTypeDist = await prisma.$queryRawUnsafe(`
    SELECT 
      "subjectType", 
      COUNT(*)::text AS row_count,
      ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM "ExamMark"), 2)::text AS pct
    FROM "ExamMark"
    GROUP BY "subjectType";
  `);
  console.log('\n--- 5. SUBJECT TYPE DISTRIBUTION ---');
  console.table(subjectTypeDist);

  // 6. MarksObtained Numeric Range & Precision Analysis
  const marksStats = await prisma.$queryRawUnsafe(`
    SELECT
      MIN("marksObtained")::text AS min_marks,
      MAX("marksObtained")::text AS max_marks,
      AVG("marksObtained")::text AS avg_marks,
      COUNT(CASE WHEN "marksObtained" % 1 != 0 THEN 1 END)::text AS decimal_fraction_count,
      COUNT(CASE WHEN "marksObtained" % 1 = 0 THEN 1 END)::text AS integer_value_count
    FROM "ExamMark";
  `);
  console.log('\n--- 6. MARKS OBTAINED VALUE DISTRIBUTION ---');
  console.table(marksStats);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
