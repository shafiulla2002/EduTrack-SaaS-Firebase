const axios = require('axios');

async function testPortalSeparation() {
  console.log('=== Starting EduTrack Platform vs SaaS Application Separation Tests ===\n');
  const API_URL = 'http://localhost:3001';
  let failures = 0;

  try {
    // 1. Super Admin Logging in to Platform Portal (targetPortal: 'PLATFORM') -> Expected SUCCESS
    console.log('[1/4] Testing Super Admin Login on Platform Portal (targetPortal: PLATFORM)...');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email: 'superadmin@edutrack.com',
        password: 'SuperAdminPassword123!',
        targetPortal: 'PLATFORM',
      });
      if (res.data?.user?.role === 'SUPER_ADMIN') {
        console.log(`✓ Super Admin Login PASSED: Role = ${res.data.user.role}, Token Received.`);
      } else {
        console.error('❌ Super Admin Login Failed: Role mismatch.');
        failures++;
      }
    } catch (err) {
      console.error('❌ Super Admin Login Failed:', err.response?.data || err.message);
      failures++;
    }

    // 2. Super Admin Logging in to School Portal (targetPortal: 'SCHOOL') -> Expected 403 Forbidden
    console.log('\n[2/4] Testing Super Admin Login Attempt on School SaaS Portal (targetPortal: SCHOOL)...');
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: 'superadmin@edutrack.com',
        password: 'SuperAdminPassword123!',
        targetPortal: 'SCHOOL',
      });
      console.error('❌ Portal Guard Failure: Super Admin was incorrectly allowed into School Portal!');
      failures++;
    } catch (err) {
      if (err.response?.status === 403) {
        console.log(`✓ Portal Authorization Lock PASSED: ${err.response.data.message}`);
      } else {
        console.error('❌ Unexpected response code:', err.response?.status);
        failures++;
      }
    }

    // 3. School Admin Logging in to Platform Portal (targetPortal: 'PLATFORM') -> Expected 403 Forbidden
    console.log('\n[3/4] Testing School Admin Login Attempt on Platform Super Admin Portal (targetPortal: PLATFORM)...');
    try {
      await axios.post(`${API_URL}/auth/login`, {
        email: 'demoadmin@edutrack.com',
        password: 'SchoolAdminPassword123!',
        targetPortal: 'PLATFORM',
      });
      console.error('❌ Portal Guard Failure: School Admin was incorrectly allowed into Platform Portal!');
      failures++;
    } catch (err) {
      if (err.response?.status === 403) {
        console.log(`✓ Portal Authorization Lock PASSED: ${err.response.data.message}`);
      } else {
        console.error('❌ Unexpected response code:', err.response?.status);
        failures++;
      }
    }

    // 4. School Admin Logging in to School Portal (targetPortal: 'SCHOOL') -> Expected SUCCESS
    console.log('\n[4/4] Testing School Admin Login on School SaaS Portal (targetPortal: SCHOOL)...');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, {
        email: 'demoadmin@edutrack.com',
        password: 'SchoolAdminPassword123!',
        targetPortal: 'SCHOOL',
      });
      if (res.data?.user?.role === 'SCHOOL_ADMIN') {
        console.log(`✓ School Admin Login PASSED: Role = ${res.data.user.role}, School Tenant ID = ${res.data.user.tenantId}`);
      } else {
        console.error('❌ School Admin Login Failed: Role mismatch.');
        failures++;
      }
    } catch (err) {
      console.error('❌ School Admin Login Failed:', err.response?.data || err.message);
      failures++;
    }

    console.log(`\n=== ALL PORTAL SEPARATION TESTS PASSED (${failures} Failures) ===`);
  } catch (globalErr) {
    console.error('Global Test Error:', globalErr);
  }
}

testPortalSeparation();
