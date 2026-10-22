const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
    
    const count = await prisma.period.count({
      where: { tenantId }
    });
    console.log("Total periods in Cambridge:", count);

    const firstFew = await prisma.period.findMany({
      where: { tenantId },
      take: 5,
      include: {
        teacher: { include: { user: true } },
        classSection: { include: { class: true, section: true } },
        subject: true
      }
    });
    console.log("First few periods:", JSON.stringify(firstFew, null, 2));

    const timings = await prisma.periodTiming.findMany({
      where: { tenantId }
    });
    console.log(`Period Timings (${timings.length}):`);
    for (const t of timings) {
      console.log(`- Period ${t.periodNumber}: ${t.startTime} - ${t.endTime}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
