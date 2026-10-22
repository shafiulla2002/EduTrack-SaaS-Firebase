const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Running raw SQL query...');
    const result = await prisma.$queryRaw`
      SELECT id, name, "subDomain" as sub_domain, "createdAt" as created_at
      FROM "Tenant"
      ORDER BY "createdAt";
    `;
    console.log('Query Results:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('SQL Execution Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
