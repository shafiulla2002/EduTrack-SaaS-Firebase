const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('--- VERIFYING SCHOOLS (TENANTS) ---');
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subDomain: true,
        createdAt: true
      }
    });
    console.log(`Total Tenants found: ${tenants.length}`);
    console.log('Tenants details:', JSON.stringify(tenants, null, 2));

    console.log('\n--- VERIFYING LINKED USERS BY ROLE ---');
    for (const tenant of tenants) {
      console.log(`\nTenant: ${tenant.name} (${tenant.subDomain}) - ${tenant.id}`);
      
      const adminCount = await prisma.user.count({
        where: { tenantId: tenant.id, role: 'SCHOOL_ADMIN' }
      });
      const teacherCount = await prisma.user.count({
        where: { tenantId: tenant.id, role: 'TEACHER' }
      });
      const driverCount = await prisma.user.count({
        where: { tenantId: tenant.id, role: 'DRIVER' }
      });
      const parentCount = await prisma.user.count({
        where: { tenantId: tenant.id, role: 'PARENT' }
      });
      const studentCount = await prisma.user.count({
        where: { tenantId: tenant.id, role: 'STUDENT' }
      });

      console.log(`- School Admins: ${adminCount}`);
      console.log(`- Teachers: ${teacherCount}`);
      console.log(`- Drivers: ${driverCount}`);
      console.log(`- Parents: ${parentCount}`);
      console.log(`- Students: ${studentCount}`);

      // Let's print users and phone numbers for each tenant to make them easy to test
      const users = await prisma.user.findMany({
        where: { tenantId: tenant.id },
        select: {
          name: true,
          email: true,
          phone: true,
          role: true
        }
      });
      console.log('Registered Users:', users);
    }
  } catch (error) {
    console.error('Error verifying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
