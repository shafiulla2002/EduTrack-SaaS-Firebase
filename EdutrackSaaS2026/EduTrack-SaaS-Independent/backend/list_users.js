const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    include: {
      tenant: true
    },
    orderBy: {
      tenant: {
        name: 'asc'
      }
    }
  });
  
  console.log("=== ALL USERS LIST (TENANT ID, PHONE, SCHOOL NAME) ===");
  console.log("School Name | Name | Role | Email | Phone | Tenant ID | User ID");
  console.log("------------------------------------------------------------------");
  for (const u of users) {
    const schoolName = u.tenant ? u.tenant.name : 'Unknown Tenant';
    console.log(`${schoolName} | ${u.name} | ${u.role} | ${u.email || 'N/A'} | ${u.phone || 'N/A'} | ${u.tenantId} | ${u.id}`);
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
