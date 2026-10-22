const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function analyzeFinancialStatus() {
  console.log('=== FINANCIAL STATUS ANALYSIS ===\n');

  // Check how many students, opportunities, invoices exist for this tenant
  const [studentCount, oppCount, invCount, lineItemCount] = await Promise.all([
    prisma.studentProfile.count({ where: { user: { tenantId: TENANT_ID, isActive: true } } }),
    prisma.opportunity.count({ where: { tenantId: TENANT_ID } }),
    prisma.invoice.count({ where: { tenantId: TENANT_ID } }),
    prisma.opportunityLineItem.count({ where: { opportunity: { tenantId: TENANT_ID } } }),
  ]);

  console.log(`Tenant Stats:`);
  console.log(`- Active Students: ${studentCount}`);
  console.log(`- Opportunities: ${oppCount}`);
  console.log(`- Invoices: ${invCount}`);
  console.log(`- Opportunity Line Items: ${lineItemCount}\n`);

  // Check opportunities distribution
  const oppStages = await prisma.opportunity.groupBy({
    by: ['stageName'],
    where: { tenantId: TENANT_ID },
    _count: true
  });
  console.log('Opportunity stages:', oppStages);

  // Check invoice statuses
  const invStatuses = await prisma.invoice.groupBy({
    by: ['status'],
    where: { tenantId: TENANT_ID },
    _count: true,
    _sum: { paidAmount: true, remainingBalance: true }
  });
  console.log('\nInvoice statuses:', invStatuses);

  await prisma.$disconnect();
}

analyzeFinancialStatus().catch(err => {
  console.error(err);
  process.exit(1);
});
