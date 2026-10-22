// READ-ONLY INVESTIGATION — NO MODIFICATIONS
// Connects to whatever DATABASE_URL is in .env and reports on what's there
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== READ-ONLY DATABASE INVESTIGATION ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('');

  // 1. Show which database we're connected to
  const connInfo = await prisma.$queryRaw`SELECT current_database(), current_schema(), inet_server_addr(), inet_server_port(), version()`;
  console.log('=== CONNECTION INFO ===');
  console.log('  Database:', connInfo[0].current_database);
  console.log('  Schema:', connInfo[0].current_schema);
  console.log('  Server:', connInfo[0].inet_server_addr || 'N/A');
  console.log('  Port:', connInfo[0].inet_server_port || 'N/A');
  console.log('  Version:', connInfo[0].version);

  // 2. List all schemas
  const schemas = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`;
  console.log('\n=== ALL SCHEMAS ===');
  schemas.forEach(s => console.log('  ' + s.schema_name));

  // 3. List all tables in public schema and their row counts
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `;
  console.log('\n=== TABLES IN public SCHEMA ===');
  let totalRows = 0;
  for (const t of tables) {
    try {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "public"."${t.tablename}"`);
      const cnt = Number(count[0].cnt);
      totalRows += cnt;
      console.log(`  ${t.tablename}: ${cnt} rows`);
    } catch (e) {
      console.log(`  ${t.tablename}: ERROR - ${e.message.substring(0, 100)}`);
    }
  }
  console.log(`\n  TOTAL ROWS ACROSS ALL TABLES: ${totalRows}`);

  // 4. Check if there are tables in other schemas
  const otherTables = await prisma.$queryRaw`
    SELECT schemaname, tablename FROM pg_tables 
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'public')
    ORDER BY schemaname, tablename
  `;
  console.log('\n=== TABLES IN OTHER SCHEMAS ===');
  if (otherTables.length === 0) {
    console.log('  None found');
  } else {
    otherTables.forEach(t => console.log(`  ${t.schemaname}.${t.tablename}`));
  }

  // 5. Check migration history
  console.log('\n=== MIGRATION HISTORY ===');
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, started_at, finished_at, applied_steps_count
      FROM "_prisma_migrations" 
      ORDER BY finished_at
    `;
    if (migrations.length === 0) {
      console.log('  No migrations recorded');
    } else {
      migrations.forEach(m => {
        console.log(`  ${m.migration_name} | Started: ${m.started_at} | Finished: ${m.finished_at}`);
      });
    }
  } catch (e) {
    console.log('  _prisma_migrations table does not exist:', e.message.substring(0, 100));
  }

  // 6. Check for any other databases on this server
  const databases = await prisma.$queryRaw`SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`;
  console.log('\n=== ALL DATABASES ON THIS SERVER ===');
  databases.forEach(d => console.log('  ' + d.datname));

  // 7. Sample data check — peek at Tenant table
  console.log('\n=== TENANT DATA (first 5) ===');
  try {
    const tenants = await prisma.$queryRaw`SELECT id, name, "subDomain", "createdAt" FROM "Tenant" LIMIT 5`;
    if (tenants.length === 0) {
      console.log('  NO TENANTS FOUND — table is empty');
    } else {
      tenants.forEach(t => console.log(`  ID: ${t.id} | Name: ${t.name} | Subdomain: ${t.subDomain} | Created: ${t.createdAt}`));
    }
  } catch (e) {
    console.log('  Tenant table does not exist or error:', e.message.substring(0, 150));
  }

  // 8. Sample data check — peek at User table
  console.log('\n=== USER DATA (first 5) ===');
  try {
    const users = await prisma.$queryRaw`SELECT id, name, role, phone, "tenantId", "isActive" FROM "User" LIMIT 5`;
    if (users.length === 0) {
      console.log('  NO USERS FOUND — table is empty');
    } else {
      users.forEach(u => console.log(`  ${u.role} | ${u.name} | Phone: ${u.phone} | TenantID: ${u.tenantId} | Active: ${u.isActive}`));
    }
  } catch (e) {
    console.log('  User table does not exist or error:', e.message.substring(0, 150));
  }

  // 9. Check SchoolSetup
  console.log('\n=== SCHOOL SETUP DATA ===');
  try {
    const setups = await prisma.$queryRaw`SELECT id, "tenantId", "schoolName", "adminName", "mobileNumber" FROM "SchoolSetup" LIMIT 5`;
    if (setups.length === 0) {
      console.log('  NO SCHOOL SETUP FOUND — table is empty');
    } else {
      setups.forEach(s => console.log(`  ${s.schoolName} | Admin: ${s.adminName} | Phone: ${s.mobileNumber} | TenantID: ${s.tenantId}`));
    }
  } catch (e) {
    console.log('  SchoolSetup table does not exist or error:', e.message.substring(0, 150));
  }

  console.log('\n=== INVESTIGATION COMPLETE ===');
  await prisma.$disconnect();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
