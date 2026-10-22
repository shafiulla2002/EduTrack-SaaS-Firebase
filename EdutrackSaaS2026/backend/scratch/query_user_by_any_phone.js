const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        phone: '9944208351'
      }
    });
    console.log("User matching 9944208351:", user);

    const tenant = await prisma.tenant.findFirst({
      where: {
        phone: '9944208351'
      }
    });
    console.log("Tenant matching 9944208351:", tenant);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
