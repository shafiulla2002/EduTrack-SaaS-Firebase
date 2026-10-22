require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: { name: { contains: 'Baskar', mode: 'insensitive' } },
    include: {
      tenant: true,
      staffProfile: true
    }
  });

  console.log(`Found ${users.length} Baskar users:`);
  for (const u of users) {
    console.log(`User: ${u.name} (id: ${u.id}), role: ${u.role}, email: ${u.email}, tenantId: ${u.tenantId}, tenantName: ${u.tenant?.name}`);
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
