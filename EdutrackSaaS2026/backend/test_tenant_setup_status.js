const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testGetSetupStatus() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const userId = '351f0c22-b5e0-47bf-a1dd-933e382d6bfa'; // Shaik Shafiulla or any user

  console.log('Testing getSetupStatus queries...');
  try {
    const [
      currentUser,
      setup,
      classesCount,
      teachersCount,
      studentsCount,
      subscription
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          staffProfile: {
            select: { id: true, staffRole: true, designation: true, staffCategory: true }
          }
        },
      }),
      prisma.schoolSetup.findUnique({
        where: { tenantId },
        include: { tenant: true },
      }),
      prisma.classSection.count({
        where: {
          tenantId,
          class: {
            isActive: true,
          },
        },
      }),
      prisma.staffProfile.count({
        where: {
          user: {
            tenantId,
            isActive: true,
            role: { in: ['TEACHER', 'STAFF'] },
          },
        },
      }),
      prisma.studentProfile.count({
        where: {
          user: {
            tenantId,
            isActive: true,
          },
        },
      }),
      prisma.tenantSubscription.findUnique({
        where: { tenantId },
        include: { plan: true },
      })
    ]);

    console.log('getSetupStatus queries succeeded!');
    console.log({ classesCount, teachersCount, studentsCount, hasSetup: !!setup, hasSub: !!subscription });
  } catch (err) {
    console.error('getSetupStatus FAILED with error:', err);
  }
}

testGetSetupStatus().catch(console.error).finally(() => prisma.$disconnect());
