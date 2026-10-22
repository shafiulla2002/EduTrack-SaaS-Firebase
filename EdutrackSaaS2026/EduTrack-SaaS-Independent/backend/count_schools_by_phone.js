const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const count = await prisma.tenant.count({
      where: { phone: '9642402639' }
    });
    console.log('Schools with phone 9642402639:', count);
  } catch (err) {
    console.error('Error querying tenants:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
