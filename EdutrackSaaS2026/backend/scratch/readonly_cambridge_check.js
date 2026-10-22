// READ-ONLY: Search for Cambridge and list ALL tenants with creation dates
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== ALL TENANTS (with creation dates) ===');
  const tenants = await prisma.$queryRaw`
    SELECT id, name, "subDomain", "createdAt" 
    FROM "Tenant" 
    ORDER BY "createdAt" ASC
  `;
  tenants.forEach((t, i) => {
    console.log(`  ${i+1}. "${t.name}" | Subdomain: ${t.subDomain} | Created: ${t.createdAt}`);
  });

  // Search specifically for Cambridge (case-insensitive)
  console.log('\n=== SEARCH: "cambridge" (case-insensitive) ===');
  const cambridge = await prisma.$queryRaw`
    SELECT id, name, "subDomain", "createdAt" 
    FROM "Tenant" 
    WHERE LOWER(name) LIKE '%cambridge%'
  `;
  if (cambridge.length === 0) {
    console.log('  NOT FOUND in Tenant table');
  } else {
    cambridge.forEach(t => console.log(`  FOUND: ${t.name} | ${t.subDomain} | Created: ${t.createdAt}`));
  }

  // Also search SchoolSetup for Cambridge
  console.log('\n=== SEARCH SchoolSetup: "cambridge" ===');
  const cambridgeSetup = await prisma.$queryRaw`
    SELECT id, "schoolName", "adminName", "mobileNumber", "tenantId", "createdAt"
    FROM "SchoolSetup" 
    WHERE LOWER("schoolName") LIKE '%cambridge%'
  `;
  if (cambridgeSetup.length === 0) {
    console.log('  NOT FOUND in SchoolSetup table');
  } else {
    cambridgeSetup.forEach(s => console.log(`  FOUND: ${s.schoolName} | Admin: ${s.adminName} | Phone: ${s.mobileNumber}`));
  }

  // Also search Users for any user linked to "cambridge"
  console.log('\n=== SEARCH Users: "cambridge" in name ===');
  const cambridgeUsers = await prisma.$queryRaw`
    SELECT id, name, role, phone, "tenantId"
    FROM "User" 
    WHERE LOWER(name) LIKE '%cambridge%'
  `;
  if (cambridgeUsers.length === 0) {
    console.log('  NOT FOUND');
  } else {
    cambridgeUsers.forEach(u => console.log(`  FOUND: ${u.name} | Role: ${u.role} | Phone: ${u.phone}`));
  }

  // Show the LAST tenant created (to determine restore point coverage)
  console.log('\n=== LAST 5 TENANTS CREATED ===');
  const lastTenants = await prisma.$queryRaw`
    SELECT id, name, "subDomain", "createdAt" 
    FROM "Tenant" 
    ORDER BY "createdAt" DESC 
    LIMIT 5
  `;
  lastTenants.forEach(t => {
    console.log(`  "${t.name}" | Created: ${t.createdAt}`);
  });

  // Show all SchoolSetup entries
  console.log('\n=== ALL SCHOOL SETUPS ===');
  const allSetups = await prisma.$queryRaw`
    SELECT "schoolName", "adminName", "mobileNumber", "createdAt"
    FROM "SchoolSetup" 
    ORDER BY "createdAt" ASC
  `;
  allSetups.forEach((s, i) => {
    console.log(`  ${i+1}. "${s.schoolName}" | Admin: ${s.adminName} | Phone: ${s.mobileNumber} | Created: ${s.createdAt}`);
  });

  // Check migration history
  console.log('\n=== MIGRATION HISTORY ===');
  const migrations = await prisma.$queryRaw`
    SELECT migration_name, started_at, finished_at 
    FROM "_prisma_migrations" 
    ORDER BY finished_at
  `;
  migrations.forEach(m => {
    console.log(`  ${m.migration_name} | Applied: ${m.finished_at}`);
  });

  // Check which tables exist vs which the current code expects
  console.log('\n=== CHECK FOR COMMUNICATION TABLES ===');
  const commTables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('Communication', 'CommunicationAttachment', 'CommunicationRecipient', 'TimetableConfig')
    ORDER BY tablename
  `;
  if (commTables.length === 0) {
    console.log('  Communication, CommunicationAttachment, CommunicationRecipient: DO NOT EXIST');
  } else {
    commTables.forEach(t => console.log(`  ${t.tablename}: EXISTS`));
  }

  // Check Announcement table columns
  console.log('\n=== ANNOUNCEMENT TABLE COLUMNS ===');
  const annCols = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'Announcement'
    ORDER BY ordinal_position
  `;
  annCols.forEach(c => console.log(`  ${c.column_name} (${c.data_type}) ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`));

  // Check for missing enums
  console.log('\n=== CHECK FOR COMMUNICATION ENUMS ===');
  const enums = await prisma.$queryRaw`
    SELECT typname FROM pg_type 
    WHERE typname IN ('CommunicationType', 'CommunicationPriority', 'CommunicationStatus')
  `;
  if (enums.length === 0) {
    console.log('  Communication enums DO NOT EXIST (need to be created)');
  } else {
    enums.forEach(e => console.log(`  ${e.typname}: EXISTS`));
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
