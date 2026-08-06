const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      phone: true,
      role: true,
      name: true
    }
  });
  console.log('Registered users:', users);
}

run().finally(() => prisma.$disconnect());
