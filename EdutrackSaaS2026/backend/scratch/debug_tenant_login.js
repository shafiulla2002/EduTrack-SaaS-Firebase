const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. List all tenants
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, subDomain: true, createdAt: true }
  });
  console.log('=== ALL TENANTS ===');
  tenants.forEach(t => {
    console.log(`  ID: ${t.id} | Name: ${t.name} | Subdomain: ${t.subDomain} | Created: ${t.createdAt}`);
  });

  // 2. Find Cambridge tenant specifically
  const cambridge = tenants.find(t => t.name.toLowerCase().includes('cambridge'));
  if (cambridge) {
    console.log('\n=== CAMBRIDGE TENANT FOUND ===');
    console.log(`  ID: ${cambridge.id}`);
    console.log(`  Name: ${cambridge.name}`);
    console.log(`  Subdomain: ${cambridge.subDomain}`);

    // 3. Find all users for this tenant
    const users = await prisma.user.findMany({
      where: { tenantId: cambridge.id },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true }
    });
    console.log(`\n=== USERS FOR CAMBRIDGE (${users.length}) ===`);
    users.forEach(u => {
      console.log(`  ${u.role} | Name: ${u.name} | Email: ${u.email} | Phone: ${u.phone} | Active: ${u.isActive}`);
    });

    // 4. Find admin users
    const admins = users.filter(u => u.role === 'SCHOOL_ADMIN');
    console.log(`\n=== ADMIN USERS (${admins.length}) ===`);
    admins.forEach(a => {
      console.log(`  Name: ${a.name} | Email: ${a.email} | Phone: ${a.phone}`);
    });

    // 5. Check staff profiles
    const staffProfiles = await prisma.staffProfile.findMany({
      where: { tenantId: cambridge.id },
      include: { user: { select: { name: true, role: true, phone: true } } }
    });
    console.log(`\n=== STAFF PROFILES (${staffProfiles.length}) ===`);
    staffProfiles.forEach(s => {
      console.log(`  ID: ${s.id} | User: ${s.user.name} | Role: ${s.user.role} | Phone: ${s.user.phone} | Status: ${s.status}`);
    });

    // 6. Check school setup
    const setup = await prisma.schoolSetup.findUnique({
      where: { tenantId: cambridge.id }
    });
    console.log('\n=== SCHOOL SETUP ===');
    console.log(`  School Name: ${setup?.schoolName}`);
    console.log(`  Admin Name: ${setup?.adminName}`);
    console.log(`  Mobile: ${setup?.mobileNumber}`);
  } else {
    console.log('\nNo Cambridge tenant found!');
  }

  // 7. Search for any user by phone with "cambridge" or common numbers
  console.log('\n=== ALL SCHOOL_ADMIN USERS (ALL TENANTS) ===');
  const allAdmins = await prisma.user.findMany({
    where: { role: 'SCHOOL_ADMIN' },
    select: { id: true, name: true, email: true, phone: true, tenantId: true, isActive: true }
  });
  allAdmins.forEach(a => {
    const tenant = tenants.find(t => t.id === a.tenantId);
    console.log(`  ${a.name} | Phone: ${a.phone} | Tenant: ${tenant?.name || a.tenantId} | Active: ${a.isActive}`);
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
