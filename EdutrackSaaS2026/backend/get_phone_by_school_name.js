const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { name: 'A.P.GreenWood High School' },
      select: { phone: true, name: true }
    });
    if (tenant) {
      console.log(`School "${tenant.name}" is registered with phone: ${tenant.phone}`);
    } else {
      console.log('No school found with that name');
    }
  } catch (err) {
    console.error('Error querying tenant phone:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
