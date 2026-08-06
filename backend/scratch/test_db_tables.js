const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:School2026DB@school-management-db-recovered-final-v2.cex84kesyw9q.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&connection_limit=15&pool_timeout=60'
    }
  }
});

async function main() {
  console.log('Testing PostgreSQL table structures...');
  const subCount = await prisma.tenantSubscription.count().catch((e) => console.log('tenantSubscription count error:', e.message));
  console.log('TenantSubscription count in DB:', subCount);

  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: true,
      users: { where: { role: 'SCHOOL_ADMIN' }, take: 1 },
      _count: { select: { studentProfiles: true, staffProfiles: true } }
    },
    take: 5
  });

  console.log('Successfully fetched tenants using backend schema:');
  tenants.forEach(t => console.log(`- ${t.name} (${t.subDomain}) | Sub: ${t.subscription?.status || 'NONE'} | Admin: ${t.users[0]?.email} | Students: ${t._count.studentProfiles}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
