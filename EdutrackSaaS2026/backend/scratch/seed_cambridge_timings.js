const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
  
  // Clear any existing just in case
  await prisma.periodTiming.deleteMany({ where: { tenantId } });

  const defaultTimings = [
    { periodNumber: 1, startTime: '09:00 AM', endTime: '10:00 AM', isActive: true, tenantId },
    { periodNumber: 2, startTime: '10:00 AM', endTime: '11:00 AM', isActive: true, tenantId },
    { periodNumber: 3, startTime: '11:00 AM', endTime: '12:00 PM', isActive: true, tenantId },
    { periodNumber: 4, startTime: '12:00 PM', endTime: '01:00 PM', isActive: true, tenantId },
    { periodNumber: 5, startTime: '01:00 PM', endTime: '02:00 PM', isActive: true, tenantId },
    { periodNumber: 6, startTime: '02:00 PM', endTime: '03:00 PM', isActive: true, tenantId },
    { periodNumber: 7, startTime: '03:00 PM', endTime: '04:00 PM', isActive: true, tenantId },
    { periodNumber: 8, startTime: '04:00 PM', endTime: '05:00 PM', isActive: true, tenantId },
  ];

  await prisma.periodTiming.createMany({
    data: defaultTimings
  });

  console.log('Seeded 8 periods for Cambridge International School successfully.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
