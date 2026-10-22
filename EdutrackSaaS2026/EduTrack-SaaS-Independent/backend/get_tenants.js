const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tenants = await prisma.tenant.findMany({
    include: {
      users: {
        where: { role: 'SCHOOL_ADMIN' }
      }
    }
  });
  console.log("=== TENANTS AND ADMINS ===");
  for (const t of tenants) {
    console.log(`Tenant Name: ${t.name}`);
    console.log(`Subdomain: ${t.subDomain}`);
    console.log(`ID: ${t.id}`);
    console.log("Admins:");
    for (const u of t.users) {
      console.log(`  - Name: ${u.name}, Email: ${u.email}, Phone: ${u.phone}`);
    }
    console.log("------------------------");
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
