const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:School2026DB@school-management-db-recovered-final-v2.cex84kesyw9q.us-east-1.rds.amazonaws.com:5432/postgres?schema=public"
    }
  }
});

async function run() {
  try {
    const cambridgeTenant = await prisma.tenant.findFirst({
      where: { name: { contains: 'Cambridge', mode: 'insensitive' } }
    });

    if (!cambridgeTenant) {
      console.log('Cambridge school not found.');
      return;
    }

    console.log(`Cambridge International School ID: ${cambridgeTenant.id}`);
    
    // Find some users with non-empty phone numbers
    const users = await prisma.user.findMany({
      where: {
        tenantId: cambridgeTenant.id,
        role: { in: ['SCHOOL_ADMIN', 'TEACHER'] },
        phone: { not: null }
      },
      select: {
        name: true,
        role: true,
        phone: true,
        email: true
      },
      take: 10
    });

    console.log('\n--- CAMBRIDGE INTERNATIONAL SCHOOL USER CREDENTIALS ---');
    console.table(users);

  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
