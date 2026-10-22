const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: { phone: { endsWith: '7989725121' } },
    include: { tenant: true }
  });
  console.log('Users matching endsWith 7989725121:', JSON.stringify(users, null, 2));
}

run().finally(() => prisma.$disconnect());
