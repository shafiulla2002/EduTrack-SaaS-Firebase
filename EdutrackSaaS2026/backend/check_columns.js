const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log(result);
}

run().catch(console.error).finally(() => prisma.$disconnect());

