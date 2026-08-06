const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const phone = '9642402639';
  const user = await prisma.user.findFirst({
    where: {
      phone: {
        endsWith: phone
      }
    },
    include: {
      tenant: true
    }
  });
  console.log('User for 9642402639:', user);
}

run().finally(() => prisma.$disconnect());
