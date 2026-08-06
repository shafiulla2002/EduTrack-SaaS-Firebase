const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createCredentials() {
  console.log('=== Creating Dedicated Super Admin & Test School Account ===');

  // 1. Ensure default tenant or system tenant exists for Super Admin
  let systemTenant = await prisma.tenant.findFirst({ where: { subDomain: 'platform-admin' } });
  if (!systemTenant) {
    systemTenant = await prisma.tenant.create({
      data: {
        name: 'EduTrack SaaS Platform',
        subDomain: 'platform-admin',
        setupCompleted: true,
      },
    });
    console.log(`Created system tenant for platform super admin: ${systemTenant.id}`);
  }

  // 2. Create or Update Super Admin User
  const superAdminPasswordHash = await bcrypt.hash('SuperAdminPassword123!', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@edutrack.com' },
    create: {
      email: 'superadmin@edutrack.com',
      name: 'EduTrack Super Admin',
      passwordHash: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
      tenantId: systemTenant.id,
    },
    update: {
      passwordHash: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`✓ Super Admin account verified: ${superAdmin.email}`);

  // 3. Create Dedicated E2E Test School Tenant
  let demoTenant = await prisma.tenant.findUnique({ where: { subDomain: 'edutrack-demo-academy' } });
  if (!demoTenant) {
    demoTenant = await prisma.tenant.create({
      data: {
        name: 'EduTrack Demonstration Academy',
        subDomain: 'edutrack-demo-academy',
        email: 'demoadmin@edutrack.com',
        phone: '9876543210',
        address: '123 Tech Park Road, Bengaluru',
        setupCompleted: true,
      },
    });
    console.log(`Created demo school tenant: ${demoTenant.id}`);
  }

  // 4. Create School Admin User for Demo Tenant
  const schoolAdminPasswordHash = await bcrypt.hash('SchoolAdminPassword123!', 10);
  const demoSchoolAdmin = await prisma.user.upsert({
    where: { email: 'demoadmin@edutrack.com' },
    create: {
      email: 'demoadmin@edutrack.com',
      name: 'Demonstration School Admin',
      phone: '9876543210',
      passwordHash: schoolAdminPasswordHash,
      role: 'SCHOOL_ADMIN',
      tenantId: demoTenant.id,
    },
    update: {
      passwordHash: schoolAdminPasswordHash,
      role: 'SCHOOL_ADMIN',
    },
  });

  console.log(`✓ Demo School Admin account verified: ${demoSchoolAdmin.email}`);

  // 5. Ensure Trial Subscription for Demo Tenant
  const trialPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'TRIAL' } });
  if (trialPlan) {
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6); // 6-month trial

    await prisma.tenantSubscription.upsert({
      where: { tenantId: demoTenant.id },
      create: {
        tenantId: demoTenant.id,
        planId: trialPlan.id,
        expiryDate,
        status: 'TRIAL',
      },
      update: {
        planId: trialPlan.id,
        status: 'TRIAL',
      },
    });
    console.log(`✓ Demo Tenant trial subscription activated.`);
  }

  console.log('\n=== CREDENTIALS CREATION COMPLETE ===');
  await prisma.$disconnect();
}

createCredentials();
