const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany();
  for (const tenant of tenants) {
    const students = await prisma.studentProfile.count({
      where: { user: { tenantId: tenant.id } }
    });
    const activeStudents = await prisma.studentProfile.count({
      where: { user: { tenantId: tenant.id, isActive: true } }
    });
    const teachers = await prisma.staffProfile.count({
      where: { user: { tenantId: tenant.id, role: 'TEACHER' } }
    });
    const activeTeachers = await prisma.staffProfile.count({
      where: { user: { tenantId: tenant.id, role: 'TEACHER', isActive: true } }
    });
    const classes = await prisma.class.count({
      where: { tenantId: tenant.id }
    });
    const activeClasses = await prisma.class.count({
      where: { tenantId: tenant.id, isActive: true }
    });
    console.log(`Tenant: ${tenant.name} (${tenant.subDomain}) | ID: ${tenant.id}`);
    console.log(`  Students: total=${students}, active=${activeStudents}`);
    console.log(`  Teachers: total=${teachers}, active=${activeTeachers}`);
    console.log(`  Classes: total=${classes}, active=${activeClasses}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
