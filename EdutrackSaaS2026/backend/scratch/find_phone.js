const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: {
      phone: '1155997755'
    }
  });

  console.log("Users with phone 1155997755:", JSON.stringify(users, null, 2));
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
