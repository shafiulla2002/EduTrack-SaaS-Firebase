const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log("ALL TENANTS:", tenants.map(t => ({ id: t.id, name: t.name, subdomain: t.subDomain })));

  const classes = await prisma.class.findMany();
  console.log("ALL CLASSES:", classes.map(c => ({ id: c.id, name: c.name, tenantId: c.tenantId, isActive: c.isActive })));

  const teachers = await prisma.staffProfile.findMany({
    include: { user: true }
  });
  console.log("ALL STAFF PROFILES:", teachers.map(t => ({ id: t.id, name: t.user?.name, role: t.user?.role, tenantId: t.user?.tenantId })));
  
  await prisma.$disconnect();
}

main();
