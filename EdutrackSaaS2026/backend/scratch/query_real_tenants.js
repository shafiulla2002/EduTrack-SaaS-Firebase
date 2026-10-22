const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:School2026DB@school-management-db-recovered-final-v2.cex84kesyw9q.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&connection_limit=15&pool_timeout=60'
    }
  }
});

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: true,
      users: {
        where: { role: 'SCHOOL_ADMIN' },
        take: 1
      }
    }
  });
  console.log(`TOTAL REAL TENANTS IN DATABASE: ${tenants.length}`);
  tenants.forEach(t => console.log(`- [${t.id}] ${t.name} (${t.subDomain}) | Admin: ${t.users[0]?.email || 'N/A'} | Status: ${t.subscription?.status || 'TRIAL'}`));

  const totalStudents = await prisma.studentProfile.count();
  const totalTeachers = await prisma.staffProfile.count();
  const totalUsers = await prisma.user.count();
  console.log({ totalStudents, totalTeachers, totalUsers });
}

main().catch(console.error).finally(() => prisma.$disconnect());
