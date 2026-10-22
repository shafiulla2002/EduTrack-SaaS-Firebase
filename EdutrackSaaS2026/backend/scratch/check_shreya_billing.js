const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.studentProfile.findFirst({
    where: {
      user: { name: { contains: 'Shreya', mode: 'insensitive' } }
    },
    include: {
      user: true,
      classSection: { include: { class: true, section: true } },
      opportunities: {
        include: {
          opportunityLineItems: { include: { product: true } },
          invoices: { include: { invoiceItems: true } }
        }
      }
    }
  });

  if (!student) {
    console.log('Student Shreya not found.');
    return;
  }

  console.log('Student:', student.id, student.user.name, 'Roll:', student.rollNo, 'Tenant:', student.tenantId);
  console.log('Opportunities:', student.opportunities.length);

  for (const opp of student.opportunities) {
    console.log(`Opp ID: ${opp.id}, status: ${opp.status}, stage: ${opp.stage}, amount: ${opp.amount}`);
    console.log('  Line Items:', opp.opportunityLineItems.length);
    for (const oli of opp.opportunityLineItems) {
      console.log(`    OLI: ${oli.id}, productName: ${oli.product?.name}, unitPrice: ${oli.unitPrice}, quantity: ${oli.quantity}, discount: ${oli.discount}`);
    }
    console.log('  Invoices:', opp.invoices.length);
    for (const inv of opp.invoices) {
      console.log(`    Invoice: ${inv.id}, number: ${inv.invoiceNumber}, status: ${inv.status}, total: ${inv.totalAmount}, paid: ${inv.paidAmount}, remBalance: ${inv.remainingBalance}`);
      for (const item of inv.invoiceItems) {
        console.log(`      Item: ${item.id}, description: ${item.description}, amount: ${item.amount}, paidAmount: ${item.paidAmount}`);
      }
    }
  }

  const orphanInvoices = await prisma.invoice.findMany({
    where: { studentId: student.id, opportunityId: null },
    include: { invoiceItems: true }
  });
  console.log('Orphan Invoices (no opp ID):', orphanInvoices.length);
  for (const inv of orphanInvoices) {
    console.log(`  Orphan Invoice: ${inv.id}, number: ${inv.invoiceNumber}, status: ${inv.status}, total: ${inv.totalAmount}, paid: ${inv.paidAmount}, remBalance: ${inv.remainingBalance}`);
    for (const item of inv.invoiceItems) {
      console.log(`    Item: ${item.id}, description: ${item.description}, amount: ${item.amount}, paidAmount: ${item.paidAmount}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
