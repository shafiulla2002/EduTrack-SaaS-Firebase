const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

  console.log('Testing updated JS-based getTeachers filtering...');
  
  const staff = await prisma.staffProfile.findMany({
    where: {
      tenantId,
      user: {
        isActive: true,
        role: { in: ['TEACHER', 'SCHOOL_ADMIN', 'STAFF'] },
      },
      NOT: [{ staffCategory: 'NON_TEACHING' }],
    },
    include: {
      user: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
    take: 1000,
  });

  const nonTeachingKeywords = [
    'driver', 'account', 'librar', 'secur', 'peon', 'clerk',
    'clean', 'attend', 'maintenance', 'support', 'bus', 'watchman',
    'helper', 'sweeper', 'non-teaching', 'non teaching', 'transport'
  ];

  const teachingStaff = staff.filter(s => {
    if (s.staffCategory === 'NON_TEACHING') return false;
    const desig = (s.designation || '').toLowerCase();
    const role = (s.staffRole || '').toLowerCase();
    
    if (nonTeachingKeywords.some(kw => desig.includes(kw) || role.includes(kw))) {
      return false;
    }
    return true;
  });

  console.log(`Success! Found ${teachingStaff.length} valid teaching faculty records (out of ${staff.length} total staff):`);
  teachingStaff.forEach(s => {
    console.log(` - ${s.user?.name} (${s.user?.role}) | desig: ${s.designation} | role: ${s.staffRole} | cat: ${s.staffCategory}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
