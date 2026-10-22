// READ-ONLY: Check current database state - no modifications
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== READ-ONLY DATABASE STATE CHECK ===');
  console.log('Time:', new Date().toISOString());
  console.log('');

  // 1. List all tables and their row counts
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `;
  console.log('=== TABLES IN DATABASE ===');
  for (const t of tables) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "${t.tablename}"`);
      console.log(`  ${t.tablename}: ${count[0].cnt} rows`);
    } catch (e) {
      console.log(`  ${t.tablename}: ERROR reading - ${e.message}`);
    }
  }

  // 2. Check migration history
  console.log('\n=== MIGRATION HISTORY ===');
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count 
      FROM _prisma_migrations 
      ORDER BY finished_at
    `;
    migrations.forEach(m => {
      console.log(`  ${m.migration_name} | Applied: ${m.finished_at} | Steps: ${m.applied_steps_count}`);
    });
  } catch (e) {
    console.log('  Could not read migration history:', e.message);
  }

  // 3. Check if any data exists in key tables
  console.log('\n=== KEY DATA CHECK ===');
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, subDomain: true } });
  console.log(`  Tenants: ${tenants.length}`);
  tenants.forEach(t => console.log(`    - ${t.name} (${t.subDomain})`));

  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true } });
  console.log(`  Users: ${users.length}`);

  const staff = await prisma.staffProfile.findMany({ select: { id: true } });
  console.log(`  Staff Profiles: ${staff.length}`);

  const students = await prisma.studentProfile.findMany({ select: { id: true } });
  console.log(`  Student Profiles: ${students.length}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
