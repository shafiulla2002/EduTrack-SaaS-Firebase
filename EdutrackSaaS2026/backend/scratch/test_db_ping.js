const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ping() {
  console.log('Testing connection to PostgreSQL...');
  const res = await prisma.$queryRaw`SELECT 1 AS connected`;
  console.log('Connection response:', res);
  await prisma.$disconnect();
}

ping().catch(err => {
  console.error('Connection failed:', err.message);
  process.exit(1);
});
