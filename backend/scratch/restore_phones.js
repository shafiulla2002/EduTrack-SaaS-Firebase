const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user1 = await prisma.user.findFirst({
    where: { phone: '6309545682_old' }
  });
  if (user1) {
    console.log('Restoring Shafi phone to 6309545682...');
    await prisma.user.update({
      where: { id: user1.id },
      data: { phone: '6309545682' }
    });
  }

  const user2 = await prisma.user.findFirst({
    where: { phone: '6309545682' }
  });
  if (user2) {
    console.log('Restoring Jason phone to +919642402639...');
    await prisma.user.update({
      where: { id: user2.id },
      data: { phone: '+919642402639' }
    });
  }
  console.log('Restore complete!');
}

run().finally(() => prisma.$disconnect());
