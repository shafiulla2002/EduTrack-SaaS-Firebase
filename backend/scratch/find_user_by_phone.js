const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const phone = '7989725121';
  const users = await prisma.user.findMany({
    where: {
      phone: {
        endsWith: phone
      }
    },
    include: {
      tenant: true
    }
  });
  console.log('Users for 7989725121:', users);
}

run().finally(() => prisma.$disconnect());
