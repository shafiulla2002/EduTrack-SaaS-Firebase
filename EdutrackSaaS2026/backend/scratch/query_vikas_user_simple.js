const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'vikas', mode: 'insensitive' } },
          { name: { contains: 'vikas', mode: 'insensitive' } }
        ]
      }
    });
    console.log("Vikas User:", user);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
