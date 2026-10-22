const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tenantId = '778b7f12-d8c3-406d-926c-a403b46100ef';
  const staff = await prisma.staffProfile.findMany({
    where: { user: { tenantId } },
    include: { user: true }
  });
  console.log(JSON.stringify(staff, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
