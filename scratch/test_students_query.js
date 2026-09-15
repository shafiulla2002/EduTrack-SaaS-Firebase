const { PrismaClient, PaymentStatus } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function testStudents() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  console.log('Testing student query locally...');

  const start = Date.now();

  const [total, students] = await Promise.all([
    prisma.studentProfile.count({ where: { tenantId } }),
    prisma.studentProfile.findMany({
      where: { tenantId },
      select: {
        id: true,
        rollNo: true,
        fatherName: true,
        motherName: true,
        fatherPhone: true,
        motherPhone: true,
        guardianPhone: true,
        aadharNo: true,
        profilePhotoUrl: true,
        classSectionId: true,
        tenantId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        classSection: {
          select: {
            id: true,
            classId: true,
            sectionId: true,
            class: {
              select: {
                id: true,
                name: true,
                academicYearId: true,
              }
            },
            section: {
              select: {
                id: true,
                name: true,
                }
            }
          }
        }
      },
      skip: 0,
      take: 10
    })
  ]);

  console.log(`Fetched 10 students out of ${total} in ${Date.now() - start}ms`);

  const studentIds = students.map(s => s.id);

  const startBatch = Date.now();
  const [allOpps, allOrphanInvoices] = await Promise.all([
    prisma.opportunity.findMany({
      where: {
        studentId: { in: studentIds },
        tenantId,
      },
      select: {
        id: true,
        studentId: true,
        stageName: true,
        academicYearId: true,
        classId: true,
        createdAt: true,
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
          },
        },
        opportunityLineItems: {
          select: {
            unitPrice: true,
            quantity: true,
            discount: true,
          },
        },
        invoices: {
          where: {
            tenantId,
            status: { not: 'VOIDED' },
          },
          select: {
            paidAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: {
        studentId: { in: studentIds },
        tenantId,
        opportunityId: null,
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
      select: {
        id: true,
        studentId: true,
        remainingBalance: true,
        invoiceDate: true,
      },
    })
  ]);

  console.log(`Fetched opps (${allOpps.length}) and orphan invoices (${allOrphanInvoices.length}) in ${Date.now() - startBatch}ms`);
  await prisma.$disconnect();
}

testStudents().catch(err => {
  console.error('Error:', err);
  prisma.$disconnect();
});
