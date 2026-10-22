const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`Found ${users.length} users.`);
    users.forEach(u => {
      console.log(`User ID: ${u.id}, Name: ${u.name}, Phone: [${u.phone}], Role: ${u.role}, Tenant: ${u.tenantId}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
