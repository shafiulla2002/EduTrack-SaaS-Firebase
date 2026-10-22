const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const staff = await prisma.staffProfile.findMany({
      include: {
        user: true
      }
    });
    console.log(`Found ${staff.length} staff profiles.`);
    staff.forEach(s => {
      console.log(`Staff ID: ${s.id}, User ID: ${s.userId}, Name: ${s.user?.name}, Phone: ${s.user?.phone}, Email: ${s.user?.email}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
