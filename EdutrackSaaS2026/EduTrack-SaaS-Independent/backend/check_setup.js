const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const setups = await prisma.schoolSetup.findMany({ include: { tenant: true } });
  console.log('--- SCHOOL SETUPS ---');
  console.log(setups.map(s => ({ id: s.id, schoolName: s.schoolName, tenantId: s.tenantId, tenantName: s.tenant?.name })));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
