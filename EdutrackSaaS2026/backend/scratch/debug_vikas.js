const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const staff = await prisma.staffProfile.findFirst({
      where: {
        user: {
          name: {
            contains: 'Vikas',
            mode: 'insensitive'
          }
        }
      },
      include: {
        user: true
      }
    });
    console.log("Vikas Staff Profile:", JSON.stringify(staff, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
