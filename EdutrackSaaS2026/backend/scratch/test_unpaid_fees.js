const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.studentProfile.findFirst({
    where: {
      user: { name: { contains: 'Shreya Chawla', mode: 'insensitive' } }
    },
    include: {
      opportunities: true
    }
  });

  if (!student) {
    console.log('Shreya Chawla not found');
    return;
  }

  const oppId = student.opportunities[0]?.id;
  console.log('Opp ID:', oppId);

  const tenantId = student.tenantId;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: oppId },
    include: { academicYear: true }
  });

  const invoiceItems = await prisma.invoiceItem.findMany({
    where: {
      tenantId,
      invoice: {
        opportunityId: oppId,
        status: { in: ['PAID', 'PARTIALLY_PAID'] },
      },
    },
    include: {
      invoice: true,
    },
  });

  console.log('PAID or PARTIALLY_PAID InvoiceItems count:', invoiceItems.length);

  const oliPaidMap = new Map();
  const namePaidMap = new Map();

  for (const item of invoiceItems) {
    const invTotal = Number(item.invoice.totalAmount);
    const invPaid = Number(item.invoice.paidAmount);
    const itemPaidAmount = invTotal > 0
      ? (Number(item.amount) * (invPaid / invTotal))
      : Number(item.amount);

    if (item.opportunityLineItemId) {
      const cur = oliPaidMap.get(item.opportunityLineItemId) || 0;
      oliPaidMap.set(item.opportunityLineItemId, cur + itemPaidAmount);
    }
    if (item.name) {
      const cur = namePaidMap.get(item.name.toLowerCase()) || 0;
      namePaidMap.set(item.name.toLowerCase(), cur + itemPaidAmount);
    }
  }

  let olis = await prisma.opportunityLineItem.findMany({
    where: { opportunityId: oppId, tenantId },
    include: { product: true },
  });

  const result = olis.map(oli => {
    const totalAmount = Number(oli.unitPrice) * Number(oli.quantity);
    const discountPercent = Number(oli.discount);
    const discountAmount = (totalAmount * discountPercent) / 100;
    const netAmount = totalAmount - discountAmount;
    const paidByOli = oliPaidMap.get(oli.id) || 0;
    const paidByName = namePaidMap.get(oli.product.name.toLowerCase()) || 0;
    const paidAmount = Math.max(paidByOli, paidByName);
    const balanceDue = netAmount - paidAmount;

    return {
      productName: oli.product.name,
      totalAmount,
      paidAmount,
      balanceDue: Math.max(0, balanceDue)
    };
  });

  console.log('Unpaid fees table output for Shreya Chawla:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
