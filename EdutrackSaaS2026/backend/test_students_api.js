const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// AP Greenwood School Tenant ID
const tenantId = '778b7f12-d8c3-406d-926c-a403b46100ef';

async function run() {
  const students = await prisma.studentProfile.findMany({
    where: {
      user: {
        tenantId,
        isActive: true
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      },
      classSection: {
        include: {
          class: true,
          section: true,
        }
      },
      invoices: {
        where: { tenantId },
        select: { remainingBalance: true, paidAmount: true }
      }
    }
  });

  console.log(`Total students for tenant ${tenantId}: ${students.length}`);
  for (const s of students) {
    const paid = s.invoices?.reduce((sum, inv) => sum + Number(inv.paidAmount), 0) || 0;
    const due = s.invoices?.reduce((sum, inv) => sum + Number(inv.remainingBalance), 0) || 0;
    const total = paid + due;
    const pct = total > 0 ? Math.round((paid / total) * 100) : 100;
    console.log(`${s.user?.name}: paid=${paid}, due=${due}, total=${total}, pct=${pct}%`);
    for (const inv of s.invoices) {
      console.log(`  - Inv: paid=${inv.paidAmount}, remainingBalance=${inv.remainingBalance}`);
    }
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
