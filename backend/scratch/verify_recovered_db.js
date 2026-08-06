const { PrismaClient } = require('@prisma/client');

// Connect to the newly restored instance
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:School2026DB@3.213.83.229:5432/postgres?schema=public"
    }
  }
});

async function run() {
  try {
    console.log('Querying restored database: school-management-db-recovered-final...');
    
    // 1. SELECT id, name, "subDomain", "createdAt" FROM "Tenant" ORDER BY "createdAt"
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subDomain: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log('\n--- TENANTS IN DATABASE ---');
    console.log(JSON.stringify(tenants, null, 2));

    const cambridgeTenant = tenants.find(t => t.name.toLowerCase().includes('cambridge'));

    if (cambridgeTenant) {
      console.log(`\nCambridge International School found! ID: ${cambridgeTenant.id}`);
      
      // Fetch counts for: School Admins, Teachers, Students, Parents, Classes, Academic Years, Fee records (Invoices)
      const admins = await prisma.user.count({
        where: { tenantId: cambridgeTenant.id, role: 'SCHOOL_ADMIN' }
      });
      const teachers = await prisma.user.count({
        where: { tenantId: cambridgeTenant.id, role: 'TEACHER' }
      });
      const students = await prisma.studentProfile.count({
        where: { tenantId: cambridgeTenant.id }
      });
      const parents = await prisma.parentProfile.count({
        where: { user: { tenantId: cambridgeTenant.id } }
      });
      const classes = await prisma.class.count({
        where: { tenantId: cambridgeTenant.id }
      });
      const academicYears = await prisma.academicYear.count({
        where: { tenantId: cambridgeTenant.id }
      });
      const invoices = await prisma.invoice.count({
        where: { tenantId: cambridgeTenant.id }
      });

      console.log('\n--- CAMBRIDGE INTERNATIONAL SCHOOL ENTITY COUNTS ---');
      console.log(`- School Admins: ${admins}`);
      console.log(`- Teachers: ${teachers}`);
      console.log(`- Students: ${students}`);
      console.log(`- Parents: ${parents}`);
      console.log(`- Classes: ${classes}`);
      console.log(`- Academic Years: ${academicYears}`);
      console.log(`- Fee records (Invoices): ${invoices}`);
    } else {
      console.log('\n[Warning] Cambridge International School not found in the restored database.');
    }
  } catch (error) {
    console.error('Connection/Query Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
