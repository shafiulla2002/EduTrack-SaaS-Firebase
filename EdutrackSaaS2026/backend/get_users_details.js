const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '9d2755a9-4529-4b30-9aa9-b6404c28d338';
  const users = await prisma.user.findMany({ where: { tenantId } });
  console.log(users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
