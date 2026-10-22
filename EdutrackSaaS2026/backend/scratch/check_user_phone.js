const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        email: true,
        tenantId: true
      }
    });

    console.log("Registered Users in DB:");
    users.forEach(u => {
      console.log(`- Name: ${u.name}, Phone: [${u.phone}], Role: ${u.role}, Email: ${u.email}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
