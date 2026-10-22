const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        phone: {
          endsWith: '8351'
        }
      }
    });
    console.log("User by phone endsWith 8351:", user);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
