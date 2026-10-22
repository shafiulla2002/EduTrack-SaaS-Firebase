// READ-ONLY: Inspect exact subdomain characters
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { name: { contains: 'Cambridge' } }
  });

  console.log(`Found ${tenants.length} matching tenants:`);
  tenants.forEach(t => {
    console.log(`- ID: "${t.id}"`);
    console.log(`  Name: "${t.name}"`);
    console.log(`  Subdomain: "${t.subDomain}" (Length: ${t.subDomain.length})`);
    console.log(`  Hex:`, Buffer.from(t.subDomain).toString('hex'));
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
