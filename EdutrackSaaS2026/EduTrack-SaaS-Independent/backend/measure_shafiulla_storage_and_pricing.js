const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  console.log('=== SHAFIULLA HIGH SCHOOL DATABASE STORAGE & PRICING ANALYSIS ===');

  // 1. Query PostgreSQL table sizes
  const tableSizes = await prisma.$queryRaw`
    SELECT
      table_name,
      pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS total_size,
      pg_total_relation_size(quote_ident(table_name)) AS size_bytes
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
  `;

  console.log('\nTop PostgreSQL Table Sizes (Entire Database):');
  let dbTotalBytes = 0;
  for (const row of tableSizes) {
    dbTotalBytes += Number(row.size_bytes);
    if (row.size_bytes > 100000) {
      console.log(`  ${row.table_name}: ${row.total_size}`);
    }
  }
  const dbTotalMB = (dbTotalBytes / (1024 * 1024)).toFixed(2);
  console.log(`\nTotal Database Disk Space: ${dbTotalMB} MB`);

  // 2. Estimate Shafiulla High School's proportion of data
  // Shafiulla has 2,301 out of ~4,300 total students (~53.5% of overall database)
  const totalStudents = await prisma.studentProfile.count();
  const shafiullaStudents = await prisma.studentProfile.count({ where: { tenantId: SHAFIULLA_TENANT_ID } });
  const ratio = shafiullaStudents / totalStudents;
  const shafiullaEstimatedMB = (dbTotalMB * ratio).toFixed(2);

  console.log(`\nShafiulla High School Student Count: ${shafiullaStudents} / ${totalStudents} total students (${(ratio * 100).toFixed(1)}%)`);
  console.log(`Estimated Database Disk Usage for Shafiulla High School: ${shafiullaEstimatedMB} MB`);

  // 3. Check Subscription Plan in EduTrack database
  const tenantSub = await prisma.tenantSubscription.findFirst({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    include: { plan: true }
  });

  console.log('\nTenant Subscription in EduTrack:', tenantSub);
}

main().catch(console.error).finally(() => prisma.$disconnect());
