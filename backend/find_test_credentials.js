const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findCredentials() {
  console.log('=== Querying Super Admin and School Admin Credentials ===');
  
  // 1. Find Super Admin Users
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, email: true, phone: true, name: true, role: true, tenant: { select: { id: true, name: true, subDomain: true } } },
    take: 5,
  });

  console.log('\n--- Super Admin Accounts ---');
  console.log(JSON.stringify(superAdmins, null, 2));

  // 2. Find School Admin Users
  const schoolAdmins = await prisma.user.findMany({
    where: { role: 'SCHOOL_ADMIN' },
    select: { id: true, email: true, phone: true, name: true, role: true, tenant: { select: { id: true, name: true, subDomain: true } } },
    take: 5,
  });

  console.log('\n--- School Admin Accounts ---');
  console.log(JSON.stringify(schoolAdmins, null, 2));

  // 3. Find Default Subscription Plans
  const plans = await prisma.subscriptionPlan.findMany();
  console.log('\n--- Subscription Plans ---');
  console.log(JSON.stringify(plans, null, 2));

  await prisma.$disconnect();
}

findCredentials();
