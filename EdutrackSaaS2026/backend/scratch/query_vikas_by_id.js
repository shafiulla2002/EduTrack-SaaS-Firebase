const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: '3e0faee3-9e45-4bfb-9279-88abacfa9cc3'
      }
    });
    console.log("Vikas User record:", JSON.stringify(user, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
