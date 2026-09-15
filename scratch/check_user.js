const { PrismaClient, PaymentStatus } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  try {
    const [totalInvoices, totalCollected, totalPending] = await Promise.all([
      prisma.invoice.count({ where: { tenantId } }),
      prisma.invoice.aggregate({
        where: { tenantId, status: { not: PaymentStatus.VOIDED } },
        _sum: { paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { tenantId, status: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] } },
        _sum: { remainingBalance: true },
      }),
    ]);

    console.log({
      totalInvoices,
      totalCollected: Number(totalCollected._sum.paidAmount || 0),
      totalPending: Number(totalPending._sum.remainingBalance || 0),
    });
  } catch (e) {
    console.error('Error in getBillingSummary test:', e);
  }
  await prisma.$disconnect();
}

main();
