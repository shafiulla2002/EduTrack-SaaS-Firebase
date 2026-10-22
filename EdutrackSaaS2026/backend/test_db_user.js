const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'SCHOOL_ADMIN' },
    select: { id: true, name: true, email: true, phone: true, tenantId: true },
    take: 5,
  });
  console.log('School Admin users:', users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
