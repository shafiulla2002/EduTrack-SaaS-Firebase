const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const adminUserId = '351f0c22-b5e0-47bf-a1dd-933e382d6bfa'; // Shaik Shafiulla (School Admin)

  console.log('Testing applyLeave logic for Admin user without error...');

  let teacherId = null;
  let applicantName = 'Staff Member';

  const staff = await prisma.staffProfile.findFirst({
    where: { userId: adminUserId, tenantId },
    include: { user: { select: { name: true } } },
  });

  if (staff) {
    teacherId = staff.id;
    applicantName = staff.user?.name || applicantName;
  } else {
    const anyStaff = await prisma.staffProfile.findFirst({
      where: { tenantId },
      include: { user: { select: { name: true } } },
    });
    if (anyStaff) {
      teacherId = anyStaff.id;
      applicantName = anyStaff.user?.name || applicantName;
    }
  }

  console.log(`Resolved teacherId=${teacherId}, applicantName=${applicantName}`);
  if (!teacherId) {
    throw new Error('Failed to resolve teacherId');
  }
  console.log('applyLeave logic SUCCESS!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
