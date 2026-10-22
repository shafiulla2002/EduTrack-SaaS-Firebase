const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const staffList = await prisma.staffProfile.findMany({
      include: {
        user: true,
        tenant: true
      }
    });

    console.log("Registered Staff/Teachers:");
    staffList.forEach(s => {
      console.log(`- Name: ${s.user.name}, Phone: ${s.user.phone}, Email: ${s.user.email}, Role: ${s.user.role}, School: ${s.tenant.name}`);
    });
  } catch (err) {
    console.error('Error querying staff:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
