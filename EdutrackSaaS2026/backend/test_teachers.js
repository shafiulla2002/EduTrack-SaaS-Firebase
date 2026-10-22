const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Simulate the new getTeachers query for Shafiulla High School tenant
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  
  const staff = await prisma.staffProfile.findMany({
    where: {
      tenantId,
      user: {
        isActive: true,
        role: { in: ['TEACHER', 'SCHOOL_ADMIN', 'STAFF'] },
      },
      NOT: [{ staffCategory: 'NON_TEACHING' }],
      OR: [
        { staffCategory: 'TEACHING' },
        { staffCategory: null },
        { user: { role: 'TEACHER' } },
      ],
    },
    include: {
      user: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
    take: 1000,
  });
  
  console.log(`Found ${staff.length} teaching staff:`);
  staff.forEach(s => {
    console.log(`  - ${s.user?.name} (${s.user?.role}) | Category: ${s.staffCategory} | Designation: ${s.designation}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
