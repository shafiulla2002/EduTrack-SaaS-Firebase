const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { phone: '111-222-3333' }
  });
  console.log('--- USERS WITH PHONE 111-222-3333 ---');
  console.log(users);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
