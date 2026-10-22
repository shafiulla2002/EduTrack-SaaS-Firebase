const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  const academicYears = await prisma.academicYear.findMany({
    where: { tenantId: SHAFIULLA_TENANT_ID }
  });
  console.log('Academic Years:', academicYears);

  const minMaxDates = await prisma.attendanceSession.aggregate({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    _min: { date: true },
    _max: { date: true },
    _count: { id: true }
  });
  console.log('Attendance Sessions Min/Max/Count:', minMaxDates);

  const attendanceCount = await prisma.attendance.count({
    where: { tenantId: SHAFIULLA_TENANT_ID }
  });
  console.log('Total Individual Student Attendance Records:', attendanceCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
