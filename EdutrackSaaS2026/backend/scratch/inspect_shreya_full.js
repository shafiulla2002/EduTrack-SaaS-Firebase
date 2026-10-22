const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const student = await prisma.studentProfile.findFirst({
    where: {
      user: { name: { contains: 'Shreya Chawla', mode: 'insensitive' } }
    },
    include: {
      user: true,
      opportunities: {
        include: {
          opportunityLineItems: { include: { product: true } },
          invoices: { include: { invoiceItems: { include: { product: true, opportunityLineItem: true } } } }
        }
      }
    }
  });

  console.log(JSON.stringify(student, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
