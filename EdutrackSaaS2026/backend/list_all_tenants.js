const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subDomain: true,
        email: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    console.log('Registered schools (tenants):');
    tenants.forEach(t => {
      console.log('---');
      console.log(`ID: ${t.id}`);
      console.log(`Name: ${t.name}`);
      console.log(`SubDomain: ${t.subDomain}`);
      console.log(`Email: ${t.email}`);
      console.log(`Phone: ${t.phone}`);
      console.log(`Address: ${t.address}`);
      console.log(`Created At: ${t.createdAt}`);
      console.log(`Updated At: ${t.updatedAt}`);
    });
  } catch (e) {
    console.error('Error fetching tenants:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
