const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const count = await prisma.tenant.count();
  console.log(`Database reachable. Total tenants: ${count}`);
}

run()
  .catch((err) => {
    console.error("Database connection failed:", err.message);
  })
  .finally(() => prisma.$disconnect());
