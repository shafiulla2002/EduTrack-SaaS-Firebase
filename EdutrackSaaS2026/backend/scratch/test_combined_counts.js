const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tenantId = '51900d01-1e46-4f36-9625-9759285d5f64';

async function main() {
  const start = performance.now();

  const [counts] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE sp."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsCount",
      (SELECT COUNT(*)::int FROM "StaffProfile" st JOIN "User" u ON st."userId" = u.id WHERE st."tenantId" = ${tenantId} AND u."isActive" = true AND u."role"::text IN ('TEACHER', 'STAFF')) AS "teachersCount",
      (SELECT COUNT(*)::int FROM "ClassSection" cs JOIN "Class" c ON cs."classId" = c.id WHERE cs."tenantId" = ${tenantId} AND c."isActive" = true) AS "classesCount"
  `;

  const duration = performance.now() - start;
  console.log('Combined Counts Result:', counts);
  console.log(`Execution Time: ${duration.toFixed(2)} ms`);

  await prisma.$disconnect();
}

main().catch(console.error);
