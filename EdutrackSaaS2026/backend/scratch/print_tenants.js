const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenants = await prisma.tenant.findMany();
    console.log("Registered Tenants/Schools:");
    tenants.forEach(t => {
      console.log(`- ID: ${t.id}, Name: ${t.name}, Phone: [${t.phone}], Email: ${t.email}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
