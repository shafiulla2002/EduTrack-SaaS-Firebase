const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { phone: '9642402639' },
      select: { name: true }
    });
    if (tenant) {
      console.log('School name:', tenant.name);
    } else {
      console.log('No school found with that phone number');
    }
  } catch (err) {
    console.error('Error querying tenant name:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
