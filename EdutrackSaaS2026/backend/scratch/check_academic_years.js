require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const years = await prisma.academicYear.findMany({
    where: { tenantId: 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1' }
  });

  console.log("Academic Years in Cambridge International School:");
  for (const y of years) {
    console.log(`Year name: "${y.name}", active: ${y.isActive}, id: ${y.id}`);
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
