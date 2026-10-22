require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const teacher = await prisma.user.findFirst({
    where: { name: { contains: 'Baskar', mode: 'insensitive' } }
  });
  console.log("Teacher Baskar phone:", teacher?.phone);

  const userByPhone = await prisma.user.findFirst({
    where: { phone: '9642402639' }
  });
  console.log("User by phone 9642402639:", userByPhone?.name, "role:", userByPhone?.role, "email:", userByPhone?.email);
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
