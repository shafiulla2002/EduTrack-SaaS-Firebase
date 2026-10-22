const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== All Database Entities Audit ===');
  
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    const students = await prisma.studentProfile.findMany({
      where: { user: { tenantId: t.id } },
      include: { user: true }
    });
    const staff = await prisma.staffProfile.findMany({
      where: { user: { tenantId: t.id } },
      include: { user: true }
    });
    const classes = await prisma.class.findMany({
      where: { tenantId: t.id }
    });
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: t.id }
    });
    const expenses = await prisma.expense.findMany({
      where: { tenantId: t.id }
    });
    
    if (students.length > 0 || staff.length > 0 || classes.length > 0 || invoices.length > 0 || expenses.length > 0) {
      console.log(`Tenant: ${t.name} (${t.subDomain}) | ID: ${t.id}`);
      console.log(`  Students (${students.length}):`, students.map(s => `${s.user.name} (${s.user.isActive ? 'Active' : 'Inactive'})`).join(', '));
      console.log(`  Staff (${staff.length}):`, staff.map(s => `${s.user.name} (${s.user.role}, ${s.user.isActive ? 'Active' : 'Inactive'})`).join(', '));
      console.log(`  Classes (${classes.length}):`, classes.map(c => c.name).join(', '));
      console.log(`  Invoices (${invoices.length}):`, invoices.map(i => `Amount: ${i.totalAmount}, Status: ${i.status}`).join(', '));
      console.log(`  Expenses (${expenses.length}):`, expenses.map(e => `Amount: ${e.amount}, Category: ${e.category}`).join(', '));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
