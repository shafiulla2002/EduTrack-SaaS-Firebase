const { PrismaClient } = require('@prisma/client');

// Connect directly to the original production database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:School2026DB@school-management-db.cex84kesyw9q.us-east-1.rds.amazonaws.com:5432/postgres?schema=public"
    }
  }
});

async function run() {
  try {
    console.log('Querying original database: school-management-db...');
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subDomain: true,
        createdAt: true
      }
    });
    console.log(`Found ${tenants.length} tenants in original database.`);
    console.log('Tenants details:', JSON.stringify(tenants, null, 2));

    for (const tenant of tenants) {
      const counts = {
        users: await prisma.user.count({ where: { tenantId: tenant.id } }),
        classes: await prisma.class.count({ where: { tenantId: tenant.id } }),
        students: await prisma.studentProfile.count({ where: { tenantId: tenant.id } }),
        staff: await prisma.staffProfile.count({ where: { tenantId: tenant.id } })
      };
      console.log(`Tenant ${tenant.name}:`, counts);
    }
  } catch (error) {
    console.error('Error querying original database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
