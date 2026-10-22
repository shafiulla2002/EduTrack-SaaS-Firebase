const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  const sampleSession = await prisma.attendanceSession.findFirst({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    include: {
      classSection: {
        include: {
          class: true,
          section: true
        }
      },
      attendances: { take: 2 }
    }
  });

  console.log('Sample Attendance Session:', sampleSession);

  const distinctDates = await prisma.attendanceSession.groupBy({
    by: ['date'],
    where: { tenantId: SHAFIULLA_TENANT_ID },
    _count: { id: true },
    orderBy: { date: 'asc' }
  });

  console.log(`Total unique attendance dates currently recorded: ${distinctDates.length}`);
  if (distinctDates.length > 0) {
    console.log('First date recorded:', distinctDates[0].date);
    console.log('Last date recorded:', distinctDates[distinctDates.length - 1].date);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
