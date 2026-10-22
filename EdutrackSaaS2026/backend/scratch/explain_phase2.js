const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tenantId = '51900d01-1e46-4f36-9625-9759285d5f64'; // demo-school

async function main() {
  console.log('--- RUNNING EXPLAIN ANALYZE BEFORE INDEX OPTIMIZATION ---');

  // 1. Student Count Query
  console.log('\n--- 1. Student Count Query EXPLAIN ---');
  const q1 = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT COUNT(*) 
    FROM "StudentProfile" sp 
    INNER JOIN "User" u ON sp."userId" = u.id 
    WHERE u."tenantId" = '${tenantId}' AND u."isActive" = true;
  `);
  console.log(q1.map(r => r['QUERY PLAN']).join('\n'));

  // 2. Staff/Teacher Count Query
  console.log('\n--- 2. Teacher Count Query EXPLAIN ---');
  const q2 = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT COUNT(*) 
    FROM "StaffProfile" st 
    INNER JOIN "User" u ON st."userId" = u.id 
    WHERE u."tenantId" = '${tenantId}' AND u."isActive" = true AND u."role" = 'TEACHER';
  `);
  console.log(q2.map(r => r['QUERY PLAN']).join('\n'));

  // 3. Attendance Session Today Query
  console.log('\n--- 3. Attendance Session Date Query EXPLAIN ---');
  const q3 = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT * 
    FROM "AttendanceSession" 
    WHERE "tenantId" = '${tenantId}' AND "date" = CURRENT_DATE;
  `);
  console.log(q3.map(r => r['QUERY PLAN']).join('\n'));

  // 4. Opportunity Active Stages Query
  console.log('\n--- 4. Opportunity Active Stages Query EXPLAIN ---');
  const q4 = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT * 
    FROM "Opportunity" 
    WHERE "tenantId" = '${tenantId}' AND "stageName" NOT IN ('Closed Won', 'Closed Lost');
  `);
  console.log(q4.map(r => r['QUERY PLAN']).join('\n'));

  await prisma.$disconnect();
}

main().catch(console.error);
