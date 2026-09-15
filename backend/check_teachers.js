const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check all users with TEACHER role
  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, name: true, role: true, isActive: true, tenantId: true },
    take: 20
  });
  console.log('=== Users with TEACHER role ===');
  console.log(JSON.stringify(teachers, null, 2));
  
  // Check ALL users and their roles
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true, isActive: true },
    take: 30
  });
  console.log('=== All Users ===');
  console.log(JSON.stringify(allUsers, null, 2));

  // Check all staffProfiles with their user roles
  const staff = await prisma.staffProfile.findMany({
    include: { user: { select: { name: true, role: true, isActive: true } } },
    take: 30
  });
  console.log('=== Staff Profiles ===');
  const mapped = staff.map(s => ({
    id: s.id,
    name: s.user ? s.user.name : 'NO USER',
    role: s.user ? s.user.role : 'NO USER',
    isActive: s.user ? s.user.isActive : false,
    staffCategory: s.staffCategory,
    designation: s.designation,
    tenantId: s.tenantId
  }));
  console.log(JSON.stringify(mapped, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
