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

  // 3. Create Dedicated E2E Test School Tenant (from isolated test configuration)
  const testSubDomain = process.env.E2E_TEST_TENANT_SUBDOMAIN || process.argv[2] || 'e2e-test-academy';
  const testTenantEmail = process.env.E2E_TEST_ADMIN_EMAIL || 'testadmin@example.test';

  let testTenant = await prisma.tenant.findUnique({ where: { subDomain: testSubDomain } });
  if (!testTenant) {
    testTenant = await prisma.tenant.create({
      data: {
        name: 'E2E Test Academy',
        subDomain: testSubDomain,
        email: testTenantEmail,
        phone: '9876543210',
        address: '123 Test Park Road, Bengaluru',
        setupCompleted: true,
      },
    });
    console.log(`Created test school tenant: ${testTenant.id} (${testSubDomain})`);
  }

  // 4. Create School Admin User for Test Tenant
  const schoolAdminPasswordHash = await bcrypt.hash('SchoolAdminPassword123!', 10);
  const testSchoolAdmin = await prisma.user.upsert({
    where: { email: testTenantEmail },
    create: {
      email: testTenantEmail,
      name: 'Test School Admin',
      phone: '9876543210',
      passwordHash: schoolAdminPasswordHash,
      role: 'SCHOOL_ADMIN',
      tenantId: testTenant.id,
    },
    update: {
      passwordHash: schoolAdminPasswordHash,
      role: 'SCHOOL_ADMIN',
    },
  });

  console.log(`✓ Test School Admin account verified: ${testSchoolAdmin.email}`);

  // 5. Ensure Trial Subscription for Test Tenant
  const trialPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'TRIAL' } });
  if (trialPlan) {
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6); // 6-month trial

    await prisma.tenantSubscription.upsert({
      where: { tenantId: testTenant.id },
      create: {
        tenantId: testTenant.id,
        planId: trialPlan.id,
        expiryDate,
        status: 'TRIAL',
      },
      update: {
        planId: trialPlan.id,
        status: 'TRIAL',
      },
    });
    console.log(`✓ Test Tenant trial subscription activated.`);
  }

  console.log('\n=== CREDENTIALS CREATION COMPLETE ===');
  await prisma.$disconnect();
}

createCredentials();
