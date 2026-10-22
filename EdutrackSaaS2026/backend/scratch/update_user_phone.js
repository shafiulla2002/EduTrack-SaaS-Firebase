const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- BEFORE UPDATE ---');
  const user1Before = await prisma.user.findFirst({
    where: { phone: { endsWith: '6309545682' } },
    include: { tenant: true }
  });
  console.log('User 6309545682:', user1Before ? { name: user1Before.name, phone: user1Before.phone, school: user1Before.tenant.name } : 'Not found');

  const user2Before = await prisma.user.findFirst({
    where: { phone: { endsWith: '9642402639' } },
    include: { tenant: true }
  });
  console.log('User 9642402639:', user2Before ? { name: user2Before.name, phone: user2Before.phone, school: user2Before.tenant.name } : 'Not found');

  if (user1Before) {
    console.log(`Updating Shafi (Gandhi High School) phone to 6309545682_old...`);
    await prisma.user.update({
      where: { id: user1Before.id },
      data: { phone: '6309545682_old' }
    });
  }

  if (user2Before) {
    console.log(`Updating Jason Yeddulla (A.P. GreenWood High School) phone to 6309545682...`);
    await prisma.user.update({
      where: { id: user2Before.id },
      data: { phone: '6309545682' }
    });
  }

  console.log('--- AFTER UPDATE ---');
  const user1After = await prisma.user.findUnique({
    where: { id: user1Before ? user1Before.id : '' }
  });
  console.log('User 1 after:', user1After ? { name: user1After.name, phone: user1After.phone } : 'N/A');

  const user2After = await prisma.user.findUnique({
    where: { id: user2Before ? user2Before.id : '' }
  });
  console.log('User 2 after:', user2After ? { name: user2After.name, phone: user2After.phone } : 'N/A');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
