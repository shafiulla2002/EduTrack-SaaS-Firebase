const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const students = await prisma.studentProfile.findMany({
    include: {
      user: { select: { name: true } },
      invoices: true
    }
  });
  for (const s of students) {
    console.log(`Student: ${s.user?.name} (id: ${s.id})`);
    if (s.invoices.length === 0) {
      console.log(`  No Invoices`);
    } else {
      for (const inv of s.invoices) {
        console.log(`  Invoice id: ${inv.id}, totalAmount: ${inv.totalAmount}, paidAmount: ${inv.paidAmount}, remainingBalance: ${inv.remainingBalance}, status: ${inv.status}`);
      }
    }
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
