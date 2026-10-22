const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.studentProfile.findMany({
    include: {
      user: true,
      opportunities: {
        include: {
          opportunityLineItems: { include: { product: true } },
          invoices: { include: { invoiceItems: true } }
        }
      }
    }
  });

  for (const s of students) {
    if (s.user.name.toLowerCase().includes('shreya') || s.user.name.toLowerCase().includes('chawla')) {
      console.log('FOUND:', s.id, s.user.name, 'Roll:', s.rollNo, 'Tenant:', s.tenantId);
      console.log('  Opps:', s.opportunities.length);
      for (const opp of s.opportunities) {
        console.log('    Opp:', opp.id, 'Invoices:', opp.invoices.length);
        for (const inv of opp.invoices) {
          console.log('      Invoice:', inv.id, inv.invoiceNumber, 'Status:', inv.status, 'Total:', inv.totalAmount, 'Paid:', inv.paidAmount, 'Rem:', inv.remainingBalance);
          for (const item of inv.invoiceItems) {
            console.log(`        Item: ${item.description}, amount: ${item.amount}, paidAmount: ${item.paidAmount}`);
          }
        }
      }
      const allInvoices = await prisma.invoice.findMany({
        where: { studentId: s.id },
        include: { invoiceItems: true }
      });
      console.log('  All Invoices for student:', allInvoices.length);
      for (const inv of allInvoices) {
        console.log('    Inv:', inv.id, inv.invoiceNumber, 'Status:', inv.status, 'Total:', inv.totalAmount, 'Paid:', inv.paidAmount, 'Rem:', inv.remainingBalance);
        for (const item of inv.invoiceItems) {
          console.log(`      Item: ${item.description}, amount: ${item.amount}, paidAmount: ${item.paidAmount}`);
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
