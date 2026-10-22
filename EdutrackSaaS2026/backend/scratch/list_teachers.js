const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const teachers = await prisma.user.findMany({
      where: {
        role: 'TEACHER'
      }
    });
    console.log(`Found ${teachers.length} teachers.`);
    teachers.forEach(t => {
      console.log(`- Name: ${t.name}, Phone: [${t.phone}], Email: ${t.email}, ID: ${t.id}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
