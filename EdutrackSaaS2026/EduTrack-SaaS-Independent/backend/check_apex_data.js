const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '9d2755a9-4529-4b30-9aa9-b6404c28d338';
  console.log('=== Apex Academy 123 Data Audit ===');
  
  const users = await prisma.user.findMany({
    where: { tenantId },
    include: {
      studentProfile: true,
      staffProfile: true
    }
  });
  console.log(`Users count: ${users.length}`);
  for (const u of users) {
    console.log(`- User: ${u.name}, Role: ${u.role}, isActive: ${u.isActive}`);
    if (u.studentProfile) console.log(`  -> StudentProfile ID: ${u.studentProfile.id}`);
    if (u.staffProfile) console.log(`  -> StaffProfile ID: ${u.staffProfile.id}, status: ${u.staffProfile.status}`);
  }

  const classes = await prisma.class.findMany({ where: { tenantId } });
  console.log(`Classes count: ${classes.length}`);
  for (const c of classes) {
    console.log(`- Class: ${c.name}, isActive: ${c.isActive}`);
  }

  const invoices = await prisma.invoice.findMany({ where: { tenantId } });
  console.log(`Invoices count: ${invoices.length}`);

  const expenses = await prisma.expense.findMany({ where: { tenantId } });
  console.log(`Expenses count: ${expenses.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
