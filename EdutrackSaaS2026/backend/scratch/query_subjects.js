const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const subjects = await prisma.subject.findMany({
      where: {
        tenantId: 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1'
      }
    });

    console.log("Subjects for Cambridge:");
    subjects.forEach(s => {
      console.log(`- SubjectID: ${s.id}, Name: ${s.name}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
