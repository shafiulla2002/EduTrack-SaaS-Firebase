const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const phones = ['7989725121', '9060020002'];
  for (const phone of phones) {
    const users = await prisma.user.findMany({
      where: { phone: { endsWith: phone } }
    });
    console.log(`Users for ${phone}:`);
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Email: ${u.email}`);
    });
  }
}

run().finally(() => prisma.$disconnect());
