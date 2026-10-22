const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const student = await prisma.studentProfile.findFirst({
    where: {
      user: {
        name: { contains: 'Amarnath' }
      }
    },
    include: {
      user: true
    }
  });

  console.log("Current DB Record:", JSON.stringify(student, null, 2));
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
