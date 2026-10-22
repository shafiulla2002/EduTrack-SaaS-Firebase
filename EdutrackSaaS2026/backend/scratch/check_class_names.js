require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const classes = await prisma.class.findMany({
    where: { tenantId: 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1' }
  });

  console.log("Classes in Cambridge International School:");
  for (const c of classes) {
    console.log(`Class name: "${c.name}", length: ${c.name.length}, id: ${c.id}`);
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
