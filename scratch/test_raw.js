const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function testRawQueries() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  console.log('Testing raw queries...');

  try {
    const res1 = await prisma.$queryRaw`
      SELECT 
        COALESCE(SUM("paidAmount"), 0)::float AS "totalRevenue"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId} AND status::text = 'PAID'
    `;
    console.log('Invoice query result:', res1);
  } catch (e) {
    console.error('Invoice query failed:', e.message);
  }

  try {
    const res2 = await prisma.$queryRaw`
      SELECT
        COUNT(CASE WHEN status::text = 'PENDING' THEN 1 END)::int AS "pendingCount"
      FROM "LeaveRequest"
      WHERE "tenantId" = ${tenantId}
    `;
    console.log('LeaveRequest query result:', res2);
  } catch (e) {
    console.error('LeaveRequest query failed:', e.message);
  }

  await prisma.$disconnect();
}

testRawQueries();
