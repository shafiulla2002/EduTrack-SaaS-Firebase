const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: 'vikas123@gmail.com' },
          { phone: { contains: '8351' } }
        ]
      }
    });
    console.log("Matched Users:", JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
