const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBillingBatch() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  console.log('Testing getStudentsBillingInfoBatch simulation...');
  const start = Date.now();

  try {
    const students = await prisma.studentProfile.findMany({
      where: {
        user: {
          tenantId,
          isActive: true,
        },
      },
      select: { id: true },
      take: 20,
    });

    const studentIds = students.map(s => s.id);

    const [allOpps, allOrphanInvoices] = await Promise.all([
      prisma.opportunity.findMany({
        where: {
          studentId: { in: studentIds },
          tenantId,
        },
        select: {
          id: true,
          studentId: true,
          stageName: true,
          academicYearId: true,
          classId: true,
          createdAt: true,
          opportunityLineItems: {
            select: {
              unitPrice: true,
              quantity: true,
              discount: true,
            },
          },
          invoices: {
            where: {
              tenantId,
              status: { not: 'VOIDED' },
            },
            select: {
              paidAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.findMany({
        where: {
          studentId: { in: studentIds },
          tenantId,
          opportunityId: null,
          status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        },
        select: {
          id: true,
          studentId: true,
          remainingBalance: true,
          invoiceDate: true,
        },
      }),
    ]);

    const elapsed = Date.now() - start;
    console.log(`getStudentsBillingInfoBatch fetched ${allOpps.length} opps, ${allOrphanInvoices.length} orphan invoices in ${elapsed} ms`);
  } catch (err) {
    console.error('testBillingBatch FAILED:', err);
  }
}

testBillingBatch().catch(console.error).finally(() => prisma.$disconnect());
