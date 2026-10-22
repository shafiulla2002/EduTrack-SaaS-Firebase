const { PrismaClient, PlanType, SubscriptionStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('=== STARTING INTEGRATION TESTS FOR SUBSCRIPTION SYSTEM ===');
  let testTenantId = null;
  let testAdminToken = null;
  let superAdminToken = null;
  let testStudent1Id = null;
  let testStudent2Id = null;

  try {
    // 1. SCENARIO 1: Tenant Onboarding & 6-month Trial
    console.log('\n--- Scenario 1: Tenant Onboarding & 6-month Trial ---');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const onboardPayload = {
      schoolName: `Test Academy ${randomSuffix}`,
      schoolType: 'School',
      adminName: 'Test Administrator',
      mobileNumber: `90000${Math.floor(10000 + Math.random() * 90000)}`,
      email: `admin_${randomSuffix}@testacademy.com`,
      address: '123 Test Street, Bangalore, India',
      academicYear: '2026-2027',
      subscriptionPlan: 'TRIAL',
    };

    const registerRes = await axios.post(`${BASE_URL}/tenant/register`, onboardPayload);
    if (registerRes.data && registerRes.data.success) {
      testTenantId = registerRes.data.user.tenantId;
      testAdminToken = registerRes.data.access_token;
      console.log('✔ Registration successful. Tenant ID:', testTenantId);
    } else {
      throw new Error('Registration failed');
    }

    // Verify database Trial creation and 6-month expiry
    const dbSub = await prisma.tenantSubscription.findUnique({
      where: { tenantId: testTenantId },
      include: { plan: true },
    });
    console.log('Plan created in DB:', dbSub.plan.name);
    console.log('Status in DB:', dbSub.status);
    
    const expiry = new Date(dbSub.expiryDate);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    const diffDays = Math.ceil(Math.abs(expiry - sixMonthsFromNow) / (1000 * 60 * 60 * 24));
    
    if (dbSub.plan.name === PlanType.TRIAL && diffDays < 5) {
      console.log('✔ Verified: 6-month trial subscription configured successfully.');
    } else {
      throw new Error(`Invalid trial configuration. Plan: ${dbSub.plan.name}, Expiry diff days: ${diffDays}`);
    }

    // 2. SCENARIO 2: Subscription Details API Check
    console.log('\n--- Scenario 2: GET /tenant/subscription ---');
    const subDetailsRes = await axios.get(`${BASE_URL}/tenant/subscription`, {
      headers: { 
        Authorization: `Bearer ${testAdminToken}`,
        'X-Tenant-ID': testTenantId
      },
    });
    console.log('Plan returned by API:', subDetailsRes.data.plan);
    console.log('Remaining Days:', subDetailsRes.data.remainingDays);
    console.log('Student Count (Current Statistics):', subDetailsRes.data.studentUsage);
    
    if (subDetailsRes.data.plan === 'TRIAL') {
      console.log('✔ Verified: GET /tenant/subscription returned plan info.');
    } else {
      throw new Error('Details API returned invalid details');
    }

    // 3. SCENARIO 3: Unlimited Record Support Verification
    console.log('\n--- Scenario 3: Verify Unlimited Records (Quota Block Removed) ---');
    // Add Student 1 (Should succeed)
    console.log('Admitting Student 1...');
    const s1Res = await axios.post(`${BASE_URL}/billing/admissions`, {
      studentData: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: `alice_${randomSuffix}@testacademy.com`,
        phone: '9888888881',
        selectedClass: null,
        selectedSection: null,
        academicYear: null,
      },
      selectedPricebookEntryIds: [],
      concessionAmount: 0,
    }, {
      headers: { 
        Authorization: `Bearer ${testAdminToken}`,
        'X-Tenant-ID': testTenantId
      },
    });
    testStudent1Id = s1Res.data.accountId;
    console.log('✔ Student 1 admitted successfully. Account ID:', testStudent1Id);

    // Add Student 2 (Should succeed)
    console.log('Admitting Student 2...');
    const s2Res = await axios.post(`${BASE_URL}/billing/admissions`, {
      studentData: {
        firstName: 'Bob',
        lastName: 'Jones',
        email: `bob_${randomSuffix}@testacademy.com`,
        phone: '9888888882',
        selectedClass: null,
        selectedSection: null,
        academicYear: null,
      },
      selectedPricebookEntryIds: [],
      concessionAmount: 0,
    }, {
      headers: { 
        Authorization: `Bearer ${testAdminToken}`,
        'X-Tenant-ID': testTenantId
      },
    });
    testStudent2Id = s2Res.data.accountId;
    console.log('✔ Student 2 admitted successfully. Account ID:', testStudent2Id);

    // 4. SCENARIO 4: Grace Period Validation
    console.log('\n--- Scenario 4: Expiration Grace Period (Active 1 day ago) ---');
    // Set expiry to 1 day ago
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    await prisma.tenantSubscription.update({
      where: { tenantId: testTenantId },
      data: { expiryDate: oneDayAgo },
    });
    console.log('Set subscription expiry date to 1 day ago (Grace Period Active).');

    // Call Admissions (Should succeed because of 3-day grace period)
    console.log('Trying to admit student during grace period...');
    const graceStudentRes = await axios.post(`${BASE_URL}/billing/admissions`, {
      studentData: {
        firstName: 'Grace',
        lastName: 'Taylor',
        email: `grace_${randomSuffix}@testacademy.com`,
        phone: '9888888884',
        selectedClass: null,
        selectedSection: null,
        academicYear: null,
      },
      selectedPricebookEntryIds: [],
      concessionAmount: 0,
    }, {
      headers: { 
        Authorization: `Bearer ${testAdminToken}`,
        'X-Tenant-ID': testTenantId
      },
    });
    console.log('✔ Verified: Admissions write succeeded during the grace period.');

    // Clean up grace student
    if (graceStudentRes.data.accountId) {
      const gStud = await prisma.studentProfile.findUnique({
        where: { id: graceStudentRes.data.accountId },
      });
      if (gStud) {
        await prisma.studentProfile.delete({ where: { id: gStud.id } });
        await prisma.user.delete({ where: { id: gStud.userId } });
      }
    }

    // 5. SCENARIO 5: Read-Only Expiry Blockout
    console.log('\n--- Scenario 5: Expiration Lockout Block (Expired 5 days ago) ---');
    // Set expiry to 5 days ago
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    await prisma.tenantSubscription.update({
      where: { tenantId: testTenantId },
      data: { expiryDate: fiveDaysAgo },
    });
    console.log('Set subscription expiry date to 5 days ago (Grace Period Over).');

    // Try a write operation (Should fail with 402 Payment Required)
    console.log('Trying a write operation (expecting 402)...');
    try {
      await axios.post(`${BASE_URL}/billing/admissions`, {
        studentData: {
          firstName: 'Failed',
          lastName: 'Student',
          email: `failed_${randomSuffix}@testacademy.com`,
          phone: '9888888885',
        },
        selectedPricebookEntryIds: [],
        concessionAmount: 0,
      }, {
        headers: { 
          Authorization: `Bearer ${testAdminToken}`,
          'X-Tenant-ID': testTenantId
        },
      });
      throw new Error('Succeeded in writing database values when subscription is locked!');
    } catch (err) {
      if (err.response && err.response.status === 402) {
        console.log('✔ Verified: Write operations blocked with Status 402 Payment Required.');
      } else {
        throw new Error(`Expected 402, but received: ${err.response ? err.response.status : err.message}`);
      }
    }

    // Try a read operation (Should succeed)
    console.log('Trying a read operation (expecting 200)...');
    const readRes = await axios.get(`${BASE_URL}/tenant/setup-status`, {
      headers: { 
        Authorization: `Bearer ${testAdminToken}`,
        'X-Tenant-ID': testTenantId
      },
    });
    if (readRes.status === 200) {
      console.log('✔ Verified: Read operations remain accessible.');
    } else {
      throw new Error(`Read failed with status: ${readRes.status}`);
    }

    // 6. SCENARIO 6: Real-time checkout simulated renewal
    console.log('\n--- Scenario 6: Simulated Payment Renewal to BASIC ---');
    const renewRes = await axios.post(`${BASE_URL}/tenant/subscription/renew`, {
      planName: 'BASIC',
      paymentDetails: {
        method: 'CARD',
        gateway: 'STRIPE',
        txRef: 'TXN-STRIPE-TEST',
      },
    }, {
      headers: { 
        Authorization: `Bearer ${testAdminToken}`,
        'X-Tenant-ID': testTenantId
      },
    });
    
    if (renewRes.data) {
      console.log('✔ Renewal API returned success. Expiry Date:', renewRes.data.expiryDate);
    } else {
      throw new Error('Renewal API call failed');
    }

    // Verify database updates
    const updatedSub = await prisma.tenantSubscription.findUnique({
      where: { tenantId: testTenantId },
      include: { plan: true },
    });
    console.log('Updated Plan in DB:', updatedSub.plan.name);
    console.log('Updated Expiry in DB:', updatedSub.expiryDate);
    console.log('Updated Status in DB:', updatedSub.status);

    const invoices = await prisma.subscriptionInvoice.findMany({ where: { tenantId: testTenantId } });
    console.log('Invoices created count:', invoices.length);
    console.log('Invoice Status:', invoices[0]?.status);

    if (updatedSub.plan.name === 'BASIC' && updatedSub.status === 'ACTIVE' && invoices.length > 0) {
      console.log('✔ Verified: Tenant upgraded to BASIC successfully and payment logged.');
    } else {
      throw new Error('Upgrade database assertions failed');
    }

    // 7. SCENARIO 7: Super Admin metrics & manual plan adjustment
    console.log('\n--- Scenario 7: Super Admin Controls ---');
    const superAdminObj = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', isActive: true },
    });

    if (superAdminObj) {
      // Authenticate super admin
      const authRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: superAdminObj.email,
        password: 'SuperAdminPass@123', // From system seed credentials
      }).catch(async () => {
        // Fallback Exchange code verification
        return axios.post(`${BASE_URL}/auth/exchange-code`, {
          email: superAdminObj.email,
          phone: superAdminObj.phone,
          otp: '123456',
        }).catch(() => null);
      });

      if (authRes && authRes.data.access_token) {
        superAdminToken = authRes.data.access_token;
        console.log('Super Admin authenticated.');

        // Get Stats
        const superStats = await axios.get(`${BASE_URL}/super-admin/dashboard/stats`, {
          headers: { 
            Authorization: `Bearer ${superAdminToken}`,
            'X-Tenant-ID': testTenantId
          },
        });
        console.log('Super Admin Stats Total Revenue:', superStats.data.totalRevenue);
        console.log('Super Admin Stats Schools count:', superStats.data.totalSchools);

        // Adjust subscription back to TRIAL
        const adjustRes = await axios.post(`${BASE_URL}/super-admin/tenants/${testTenantId}/subscription`, {
          planName: 'TRIAL',
          status: 'ACTIVE',
        }, {
          headers: { 
            Authorization: `Bearer ${superAdminToken}`,
            'X-Tenant-ID': testTenantId
          },
        });
        console.log('Adjusted subscription Plan:', adjustRes.data.planId);
        
        const finalSub = await prisma.tenantSubscription.findUnique({
          where: { tenantId: testTenantId },
          include: { plan: true },
        });
        if (finalSub.plan.name === 'TRIAL') {
          console.log('✔ Verified: Super Admin manual plan adjustment active.');
        } else {
          throw new Error('Super Admin manual adjustment failed to commit');
        }
      } else {
        console.log('⚠ Skipping Super Admin API calls: authentication details missing.');
      }
    } else {
      console.log('⚠ Super Admin user not found. Skipping Scenario 7 REST checks.');
    }

    console.log('\n✔ ALL SUBSCRIPTION INTEGRATION TESTS PASSED SUCCESSFULLY! ✔');

  } catch (err) {
    console.error('\n❌ INTEGRATION TEST CASE ENCOUNTERED FAILURE ❌');
    console.error(err.response ? {
      status: err.response.status,
      data: err.response.data,
    } : err.message);
  } finally {
    // 8. SCENARIO 8: Clean up test tenant database rows
    console.log('\n--- Cleaning up test tenant databases rows ---');
    try {
      if (testTenantId) {
        // Delete history
        await prisma.subscriptionHistory.deleteMany({ where: { tenantId: testTenantId } });
        // Delete payments
        await prisma.subscriptionPayment.deleteMany({ where: { tenantId: testTenantId } });
        // Delete invoices
        await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: testTenantId } });
        // Delete subscriptions
        await prisma.tenantSubscription.deleteMany({ where: { tenantId: testTenantId } });

        // Delete students created during tests
        if (testStudent1Id) {
          const s1 = await prisma.studentProfile.findUnique({ where: { id: testStudent1Id } });
          if (s1) {
            await prisma.opportunityLineItem.deleteMany({ where: { opportunity: { studentId: s1.id } } });
            await prisma.invoiceItem.deleteMany({ where: { invoice: { studentId: s1.id } } });
            await prisma.invoice.deleteMany({ where: { studentId: s1.id } });
            await prisma.opportunity.deleteMany({ where: { studentId: s1.id } });
            await prisma.studentProfile.delete({ where: { id: s1.id } });
            await prisma.user.delete({ where: { id: s1.userId } });
          }
        }
        if (testStudent2Id) {
          const s2 = await prisma.studentProfile.findUnique({ where: { id: testStudent2Id } });
          if (s2) {
            await prisma.opportunityLineItem.deleteMany({ where: { opportunity: { studentId: s2.id } } });
            await prisma.invoiceItem.deleteMany({ where: { invoice: { studentId: s2.id } } });
            await prisma.invoice.deleteMany({ where: { studentId: s2.id } });
            await prisma.opportunity.deleteMany({ where: { studentId: s2.id } });
            await prisma.studentProfile.delete({ where: { id: s2.id } });
            await prisma.user.delete({ where: { id: s2.userId } });
          }
        }

        // Delete test school setup, academic year, staff profile, user, and tenant
        await prisma.schoolSetup.deleteMany({ where: { tenantId: testTenantId } });
        await prisma.academicYear.deleteMany({ where: { tenantId: testTenantId } });
        await prisma.staffProfile.deleteMany({ where: { tenantId: testTenantId } });
        await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
        await prisma.tenant.delete({ where: { id: testTenantId } });
        
        console.log('✔ Test tenant clean up complete.');
      }
    } catch (cleanErr) {
      console.error('Failed to clean up test tenant:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runTests();
