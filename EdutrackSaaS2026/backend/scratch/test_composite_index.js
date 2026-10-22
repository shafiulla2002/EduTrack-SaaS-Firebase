const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testIndexOptimization() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Shafiulla High School

  console.log('--- 1. EXPLAIN ANALYZE BEFORE COMPOSITE INDEX ---');
  const before = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT sp.id, sp."rollNo", u.name, u.email
    FROM "StudentProfile" sp
    JOIN "User" u ON sp."userId" = u.id
    WHERE sp."tenantId" = '${tenantId}' AND u."isActive" = true
    ORDER BY u.name ASC
    LIMIT 20;
  `);
  before.forEach(r => console.log('  ' + r['QUERY PLAN']));

  console.log('\n--- 2. CREATING COMPOSITE INDEX User_tenantId_name_isActive_idx ---');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "User_tenantId_name_isActive_idx" ON "User" ("tenantId", "name", "isActive");
  `);
  console.log('  Index created successfully.');

  console.log('\n--- 3. EXPLAIN ANALYZE AFTER COMPOSITE INDEX ---');
  const after = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT sp.id, sp."rollNo", u.name, u.email
    FROM "StudentProfile" sp
    JOIN "User" u ON sp."userId" = u.id
    WHERE sp."tenantId" = '${tenantId}' AND u."isActive" = true
    ORDER BY u.name ASC
    LIMIT 20;
  `);
  after.forEach(r => console.log('  ' + r['QUERY PLAN']));
}

testIndexOptimization().catch(console.error).finally(() => prisma.$disconnect());
