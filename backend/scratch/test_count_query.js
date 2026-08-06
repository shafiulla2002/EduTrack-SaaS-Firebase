const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:School2026DB@school-management-db-recovered-final-v2.cex84kesyw9q.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&connection_limit=15&pool_timeout=60'
    }
  }
});

async function main() {
  console.log('Testing single-query findMany with _count...');
  const tenants = await prisma.tenant.findMany({
    include: {
      subscriptions: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      users: {
        where: { role: 'SCHOOL_ADMIN' },
        take: 1
      },
      _count: {
        select: {
          students: true,
          staff: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Successfully fetched ${tenants.length} tenants in single query:`);
  tenants.forEach(t => console.log(`- ${t.name} (${t.code}): ${t._count.students} students, ${t._count.staff} staff`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
