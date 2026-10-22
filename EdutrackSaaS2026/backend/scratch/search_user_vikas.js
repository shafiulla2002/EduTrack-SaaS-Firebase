const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const staff = await prisma.staffProfile.findUnique({
      where: { id: "5a6c5d7d-0932-449a-ba6a-ef6ddad8570c" },
      include: { user: true, tenant: true }
    });
    console.log("Staff profile:", JSON.stringify(staff, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
