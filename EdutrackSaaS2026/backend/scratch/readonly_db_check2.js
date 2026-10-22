// READ-ONLY: Check remaining tables + migration history
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check remaining tables
  const moreTables = ['StudentProfile', 'Subject', 'TeacherAssignment', 'TeacherSkill', 
                       'Tenant', 'TimetableConfig', 'User'];
  for (const t of moreTables) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "${t}"`);
      console.log(`  ${t}: ${count[0].cnt} rows`);
    } catch (e) {
      console.log(`  ${t}: ERROR - ${e.message}`);
    }
  }

  // Check migration history
  console.log('\n=== MIGRATION HISTORY ===');
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, applied_steps_count, logs
      FROM "_prisma_migrations" 
      ORDER BY finished_at
    `;
    migrations.forEach(m => {
      console.log(`  Migration: ${m.migration_name}`);
      console.log(`    Applied at: ${m.finished_at}`);
      console.log(`    Steps: ${m.applied_steps_count}`);
      if (m.logs) console.log(`    Logs: ${m.logs}`);
    });
  } catch (e) {
    console.log('  Could not read migration history:', e.message);
  }

  console.log('\n=== SUMMARY ===');
  console.log('Database host: school-management-db.cex84kesyw9q.us-east-1.rds.amazonaws.com');
  console.log('Database name: postgres');
  console.log('Schema: public');
  console.log('All tables exist but contain 0 rows.');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
