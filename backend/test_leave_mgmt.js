const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

  console.log('Testing leave management queries...');

  try {
    const total = await prisma.leaveRequest.count({ where: { tenantId } });

    const leaves = await prisma.leaveRequest.findMany({
      where: { tenantId },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        },
        student: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            classSection: { include: { class: true, section: true } }
          }
        },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`getLeaveRequests SUCCESS: found ${leaves.length} records (total=${total})`);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [pending, approvedToday, rejectedToday, totalThisMonth, totalThisYear] = await Promise.all([
      prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.leaveRequest.count({
        where: { tenantId, status: 'APPROVED', updatedAt: { gte: todayStart } },
      }),
      prisma.leaveRequest.count({
        where: { tenantId, status: 'REJECTED', updatedAt: { gte: todayStart } },
      }),
      prisma.leaveRequest.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      }),
      prisma.leaveRequest.count({
        where: { tenantId, createdAt: { gte: yearStart } },
      }),
    ]);

    console.log('getLeaveStats SUCCESS:', { pending, approvedToday, rejectedToday, totalThisMonth, totalThisYear });
  } catch (err) {
    console.error('test_leave_mgmt FAILED with error:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
