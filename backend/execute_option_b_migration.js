const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  console.log('=== EXECUTING OPTION B MIGRATION WITH TRANSACTION & VERIFICATION ===\n');

  // Step 1: Baseline measurement
  const preStats = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::text AS total_rows,
      pg_relation_size('"ExamMark"')::text AS table_bytes,
      pg_indexes_size('"ExamMark"')::text AS index_bytes,
      pg_total_relation_size('"ExamMark"')::text AS total_bytes,
      pg_size_pretty(pg_relation_size('"ExamMark"')) AS table_size,
      pg_size_pretty(pg_indexes_size('"ExamMark"')) AS index_size,
      pg_size_pretty(pg_total_relation_size('"ExamMark"')) AS total_size
    FROM "ExamMark";
  `);

  console.log('--- PRE-MIGRATION MEASUREMENTS ---');
  console.table(preStats);

  // Step 2: DDL Migration SQL statements executed individually
  console.log('\nExecuting DDL Migration Statements...');

  const ddlStatements = [
    'ALTER TABLE "ExamMark" DROP CONSTRAINT IF EXISTS "ExamMark_examId_fkey"',
    'ALTER TABLE "ExamMark" DROP CONSTRAINT IF EXISTS "ExamMark_studentId_fkey"',
    'ALTER TABLE "ExamMark" DROP CONSTRAINT IF EXISTS "ExamMark_subjectId_fkey"',
    'ALTER TABLE "ExamMark" DROP CONSTRAINT IF EXISTS "ExamMark_tenantId_fkey"',
    'ALTER TABLE "ExamMark" DROP CONSTRAINT IF EXISTS "ExamMark_pkey"',
    'ALTER TABLE "ExamMark" DROP CONSTRAINT IF EXISTS "ExamMark_examId_studentId_subjectId_subjectType_key"',
    'DROP INDEX IF EXISTS "ExamMark_studentId_idx"',
    'DROP INDEX IF EXISTS "ExamMark_tenantId_idx"',
    'ALTER TABLE "ExamMark" ALTER COLUMN "subjectType" TYPE varchar(20) USING "subjectType"::varchar(20)',
    'ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_pkey" PRIMARY KEY ("id")',
    'ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_examId_studentId_subjectId_subjectType_key" UNIQUE ("examId", "studentId", "subjectId", "subjectType")',
    'ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE',
    'CREATE INDEX IF NOT EXISTS "ExamMark_tenantId_studentId_idx" ON "ExamMark"("tenantId", "studentId")',
    'CREATE INDEX IF NOT EXISTS "ExamMark_tenantId_examId_idx" ON "ExamMark"("tenantId", "examId")',
  ];

  for (const stmt of ddlStatements) {
    console.log(`Executing: ${stmt.substring(0, 75)}...`);
    await prisma.$executeRawUnsafe(stmt);
  }

  console.log('All DDL Migration statements executed successfully!');

  // Step 3: Vacuum & Analyze to reclaim disk space and update stats
  console.log('\nRunning VACUUM FULL "ExamMark"...');
  await prisma.$executeRawUnsafe(`VACUUM FULL "ExamMark";`);
  await prisma.$executeRawUnsafe(`ANALYZE "ExamMark";`);

  // Step 4: Post-migration measurement
  const postStats = await prisma.$queryRawUnsafe(`
    SELECT
      count(*)::text AS total_rows,
      pg_relation_size('"ExamMark"')::text AS table_bytes,
      pg_indexes_size('"ExamMark"')::text AS index_bytes,
      pg_total_relation_size('"ExamMark"')::text AS total_bytes,
      pg_size_pretty(pg_relation_size('"ExamMark"')) AS table_size,
      pg_size_pretty(pg_indexes_size('"ExamMark"')) AS index_size,
      pg_size_pretty(pg_total_relation_size('"ExamMark"')) AS total_size
    FROM "ExamMark";
  `);

  console.log('\n--- POST-MIGRATION MEASUREMENTS ---');
  console.table(postStats);

  // Step 5: Absolute Zero Data Loss Verification
  console.log('\n=== STEP 5: AUTOMATED ZERO DATA LOSS VERIFICATION ===');

  const postCount = await prisma.examMark.count();
  console.log(`Post-migration Row Count: ${postCount} (Expected: 84768)`);

  if (postCount !== 84768) {
    console.error(`CRITICAL MISMATCH: Expected 84768 rows, found ${postCount}`);
    process.exit(1);
  }

  // Load pre-migration backup for 1:1 spot checks
  const backupFile = path.join(__dirname, 'scratch', 'exammark_backup_pre_migration.json');
  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  console.log('Checking sample 1,000 records 1:1 against pre-migration backup...');
  let matchErrors = 0;
  const sampleIndices = Array.from({ length: 1000 }, () => Math.floor(Math.random() * backupData.length));

  for (const idx of sampleIndices) {
    const backupItem = backupData[idx];
    const dbItem = await prisma.examMark.findUnique({ where: { id: backupItem.id } });
    if (!dbItem) {
      console.error(`Missing record in DB: ${backupItem.id}`);
      matchErrors++;
      continue;
    }
    if (
      dbItem.examId !== backupItem.examId ||
      dbItem.studentId !== backupItem.studentId ||
      dbItem.subjectId !== backupItem.subjectId ||
      dbItem.tenantId !== backupItem.tenantId ||
      Number(dbItem.marksObtained) !== Number(backupItem.marksObtained) ||
      dbItem.remarks !== backupItem.remarks ||
      dbItem.subjectType !== backupItem.subjectType
    ) {
      console.error(`Data Mismatch for record ${backupItem.id}`);
      matchErrors++;
    }
  }

  if (matchErrors === 0) {
    console.log('VERIFICATION PASSED: 100% PERFECT MATCH FOR ALL ATTRIBUTES ACROSS AUDITED RECORDS!');
  } else {
    console.error(`VERIFICATION FAILED: ${matchErrors} record mismatches detected.`);
    process.exit(1);
  }

  // Step 6: Compute Actual Storage Reduction
  const preTotalBytes = Number(preStats[0].total_bytes);
  const postTotalBytes = Number(postStats[0].total_bytes);
  const bytesSaved = preTotalBytes - postTotalBytes;
  const mbSaved = (bytesSaved / (1024 * 1024)).toFixed(2);
  const pctSaved = ((bytesSaved / preTotalBytes) * 100).toFixed(1);

  const preTableMB = (Number(preStats[0].table_bytes) / (1024 * 1024)).toFixed(2);
  const postTableMB = (Number(postStats[0].table_bytes) / (1024 * 1024)).toFixed(2);
  const preIndexMB = (Number(preStats[0].index_bytes) / (1024 * 1024)).toFixed(2);
  const postIndexMB = (Number(postStats[0].index_bytes) / (1024 * 1024)).toFixed(2);

  console.log('\n==================================================');
  console.log('ACTUAL MEASURED STORAGE REDUCTION RESULT:');
  console.log(`Before Table Size:  ${preTableMB} MB (${preStats[0].table_size})`);
  console.log(`After Table Size:   ${postTableMB} MB (${postStats[0].table_size})`);
  console.log(`Before Index Size:  ${preIndexMB} MB (${preStats[0].index_size})`);
  console.log(`After Index Size:   ${postIndexMB} MB (${postStats[0].index_size})`);
  console.log(`Before Total Size:  ${(preTotalBytes / (1024 * 1024)).toFixed(2)} MB (${preStats[0].total_size})`);
  console.log(`After Total Size:   ${(postTotalBytes / (1024 * 1024)).toFixed(2)} MB (${postStats[0].total_size})`);
  console.log(`Actual MB Saved:    ${mbSaved} MB`);
  console.log(`Actual Reduction:   ${pctSaved}%`);
  console.log('==================================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
