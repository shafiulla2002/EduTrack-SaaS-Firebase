const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      tenant: true
    }
  });
  console.log("All Users:");
  for (const u of users) {
    console.log(`User: ${u.name} (Email: ${u.email}, Phone: ${u.phone}, Role: ${u.role}, Tenant: ${u.tenant?.name || 'None'}, TenantSubdomain: ${u.tenant?.subDomain || 'None'}, TenantId: ${u.tenantId})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
