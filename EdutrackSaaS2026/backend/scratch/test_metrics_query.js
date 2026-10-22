require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMetrics() {
  const pendingPayments = await prisma.subscriptionPayment.findMany({
    where: { status: 'PENDING' },
    include: {
      tenant: { select: { id: true, name: true, subDomain: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('pendingPayments count:', pendingPayments.length);
  console.log('pendingPayments:', JSON.stringify(pendingPayments, null, 2));
}

testMetrics().then(() => prisma.$disconnect());
