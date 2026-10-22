require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPayments() {
  const payments = await prisma.subscriptionPayment.findMany({
    include: {
      tenant: { select: { id: true, name: true, subDomain: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('--- ALL PAYMENTS IN DB ---');
  console.log(JSON.stringify(payments, null, 2));
}

checkPayments().then(() => prisma.$disconnect());
