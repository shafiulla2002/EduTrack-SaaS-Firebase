const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: {
        name: { equals: 'A.P.GreenWood High School', mode: 'insensitive' },
        email: { equals: 'mr.shafiulla143@gmail.com', mode: 'insensitive' }
      },
      select: { name: true, phone: true, email: true }
    });
    if (tenant) {
      console.log(`School "${tenant.name}" (email: ${tenant.email}) is registered with phone: ${tenant.phone}`);
    } else {
      console.log('No school found with that name and email');
    }
  } catch (err) {
    console.error('Error querying tenant phone:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
