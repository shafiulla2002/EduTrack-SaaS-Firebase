require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const students = await prisma.studentProfile.findMany({
    where: {
      user: {
        name: { contains: 'Vihan', mode: 'insensitive' }
      }
    },
    include: {
      user: true,
      classSection: {
        include: {
          class: {
            include: {
              academicYear: true
            }
          },
          section: true
        }
      },
      opportunities: {
        include: {
          academicYear: true,
          class: true,
          section: true,
          opportunityLineItems: {
            include: {
              product: true
            }
          }
        }
      },
      invoices: {
        include: {
          opportunity: {
            include: {
              academicYear: true
            }
          },
          invoiceItems: true
        }
      }
    }
  });

  for (const s of students) {
    console.log(`Student Name: ${s.user.name} (id: ${s.id})`);
    console.log(`Current Class Section: ${s.classSection?.class.name} (${s.classSection?.section.name}), Year: ${s.classSection?.class.academicYear.name}`);
    console.log(`Opportunities:`);
    for (const opp of s.opportunities) {
      console.log(`  Opp: id=${opp.id}, name=${opp.name}, year=${opp.academicYear?.name}, stage=${opp.stageName}, class=${opp.class?.name}, section=${opp.section?.name}`);
      for (const oli of opp.opportunityLineItems) {
        console.log(`    Line item: ${oli.product.name}, unitPrice: ${oli.unitPrice}, quantity: ${oli.quantity}, discount: ${oli.discount}`);
      }
    }
    console.log(`Invoices:`);
    for (const inv of s.invoices) {
      console.log(`  Invoice: id=${inv.id}, date=${inv.invoiceDate.toISOString().split('T')[0]}, total=${inv.totalAmount}, paid=${inv.paidAmount}, remaining=${inv.remainingBalance}, status=${inv.status}, oppYear=${inv.opportunity?.academicYear?.name || 'N/A'}`);
      for (const item of inv.invoiceItems) {
        console.log(`    Item: name=${item.name}, amount=${item.amount}`);
      }
    }
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
