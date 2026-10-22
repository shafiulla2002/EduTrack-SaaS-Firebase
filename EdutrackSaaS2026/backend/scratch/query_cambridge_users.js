// READ-ONLY check for Cambridge users
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find tenant by subdomain or name
  const tenant = await prisma.tenant.findFirst({
    where: { subDomain: 'david-school' }
  });

  if (!tenant) {
    console.log('Cambridge tenant not found!');
    return;
  }

  console.log('Found Cambridge tenant:', tenant.id, tenant.name);

  // Find all users
  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id }
  });

  console.log(`Found ${users.length} users:`);
  users.forEach(u => {
    console.log(`  - Name: "${u.name}" | Role: ${u.role} | Phone: "${u.phone}" | Email: "${u.email}" | Active: ${u.isActive}`);
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
