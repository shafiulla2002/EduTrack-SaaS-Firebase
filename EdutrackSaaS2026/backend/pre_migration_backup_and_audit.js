const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// UUID regex validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  console.log('=== STEP 1: PRE-MIGRATION BACKUP & AUDIT ===\n');

  // 1. Fetch count
  const count = await prisma.examMark.count();
  console.log(`Total ExamMark rows in DB: ${count}`);

  if (count === 0) {
    console.error('CRITICAL: No ExamMark records found to backup!');
    return;
  }

  // 2. Export full backup to JSON file
  const backupDir = path.join(__dirname, 'scratch');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, 'exammark_backup_pre_migration.json');

  console.log(`Exporting ${count} rows to backup file: ${backupPath}...`);
  const allMarks = await prisma.examMark.findMany();
  fs.writeFileSync(backupPath, JSON.stringify(allMarks, null, 2));
  console.log(`Backup completed successfully! File size: ${(fs.statSync(backupPath).size / (1024 * 1024)).toFixed(2)} MB`);

  // 3. Verify UUID validity for all columns across all 84,768 records
  console.log('\nValidating UUID string format across all records...');
  let invalidIdCount = 0;
  let invalidExamIdCount = 0;
  let invalidStudentIdCount = 0;
  let invalidSubjectIdCount = 0;
  let invalidTenantIdCount = 0;

  for (const m of allMarks) {
    if (!UUID_REGEX.test(m.id)) invalidIdCount++;
    if (!UUID_REGEX.test(m.examId)) invalidExamIdCount++;
    if (!UUID_REGEX.test(m.studentId)) invalidStudentIdCount++;
    if (!UUID_REGEX.test(m.subjectId)) invalidSubjectIdCount++;
    if (!UUID_REGEX.test(m.tenantId)) invalidTenantIdCount++;
  }

  console.log(`- Invalid 'id' UUIDs: ${invalidIdCount}`);
  console.log(`- Invalid 'examId' UUIDs: ${invalidExamIdCount}`);
  console.log(`- Invalid 'studentId' UUIDs: ${invalidStudentIdCount}`);
  console.log(`- Invalid 'subjectId' UUIDs: ${invalidSubjectIdCount}`);
  console.log(`- Invalid 'tenantId' UUIDs: ${invalidTenantIdCount}`);

  if (invalidIdCount + invalidExamIdCount + invalidStudentIdCount + invalidSubjectIdCount + invalidTenantIdCount > 0) {
    console.error('CRITICAL WARNING: Found non-UUID strings! Aborting migration.');
    process.exit(1);
  }

  console.log('\nALL 84,768 RECORDS HAVE 100% VALID UUID FORMATS across id, examId, studentId, subjectId, and tenantId!');

  // 4. Record baseline SQL stats
  const baselineStats = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::text AS total_rows,
      pg_size_pretty(pg_relation_size('"ExamMark"')) AS table_size,
      pg_relation_size('"ExamMark"')::text AS table_size_bytes,
      pg_size_pretty(pg_indexes_size('"ExamMark"')) AS index_size,
      pg_indexes_size('"ExamMark"')::text AS index_size_bytes,
      pg_size_pretty(pg_total_relation_size('"ExamMark"')) AS total_size,
      pg_total_relation_size('"ExamMark"')::text AS total_size_bytes
    FROM "ExamMark";
  `);

  console.log('\n--- BASELINE POSTGRESQL STATS BEFORE MIGRATION ---');
  console.table(baselineStats);

  // Save baseline stats to disk for automated post-migration comparison
  fs.writeFileSync(path.join(backupDir, 'baseline_stats.json'), JSON.stringify(baselineStats, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
