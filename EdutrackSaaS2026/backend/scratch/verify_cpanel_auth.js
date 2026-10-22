const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body.trim().startsWith('{') || body.trim().startsWith('[') ? JSON.parse(body) : body
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('--- STARTING VERIFICATION OF CPANEL AUTH FLOW ---');
  let success = true;
  try {
    // 1. Test Tenant Public Branding with host header matching the central hub (should NOT resolve subdomain)
    console.log('\n1. Testing public-branding on central hub host...');
    const brandingRes1 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/tenant/public-branding',
      method: 'GET',
      headers: {
        'Host': 'edutrack.covenantsynergy.in'
      }
    });
    console.log('   Status:', brandingRes1.statusCode);
    console.log('   Resolved Branding Name:', brandingRes1.body.name);
    console.log('   Resolved Branding Tenant ID:', brandingRes1.body.id);
    if (brandingRes1.body.id !== null) {
      console.error('   ❌ FAILED: Central hub hostname resolved a tenant subdomain when it shouldn\'t have!');
      success = false;
    } else {
      console.log('   ✅ SUCCESS: Central hub resolved as root (no tenant subdomain).');
    }

    // 2. Test Tenant Public Branding with host header matching a tenant subdomain (should resolve subdomain)
    console.log('\n2. Testing public-branding on tenant subdomain host (david-school.edutrack.covenantsynergy.in)...');
    const brandingRes2 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/tenant/public-branding',
      method: 'GET',
      headers: {
        'Host': 'david-school.edutrack.covenantsynergy.in'
      }
    });
    console.log('   Status:', brandingRes2.statusCode);
    console.log('   Resolved Branding Name:', brandingRes2.body.name);
    console.log('   Resolved Branding Tenant ID:', brandingRes2.body.id);
    if (brandingRes2.body.id === null || !brandingRes2.body.name.toLowerCase().includes('cambridge')) {
      console.error('   ❌ FAILED: Subdomain host failed to resolve the correct tenant context!');
      success = false;
    } else {
      console.log('   ✅ SUCCESS: Resolved tenant context from subdomain host.');
    }

    // 3. Test API Domain parsing (api-edutrack.covenantsynergy.in should not resolve as a tenant subdomain)
    console.log('\n3. Testing public-branding on API domain host...');
    const brandingRes3 = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/tenant/public-branding',
      method: 'GET',
      headers: {
        'Host': 'api-edutrack.covenantsynergy.in'
      }
    });
    console.log('   Status:', brandingRes3.statusCode);
    console.log('   Resolved Branding Tenant ID:', brandingRes3.body.id);
    if (brandingRes3.body.id !== null) {
      console.error('   ❌ FAILED: API domain hostname was parsed as a tenant subdomain!');
      success = false;
    } else {
      console.log('   ✅ SUCCESS: API domain resolved as root (no tenant subdomain resolved).');
    }

    // 4. Test OTP Verification with Code Generation (simulates hub redirect logic)
    console.log('\n4. Performing OTP verification (simulating central auth hub login)...');
    const verifyRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/auth/verify-otp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'edutrack.covenantsynergy.in'
      }
    }, {
      phone: '7989725121', // David Nikhals (Cambridge Admin)
      otpCode: 'MOCK_FIREBASE_ID_TOKEN',
      portal: 'admin',
      generateCode: true
    });
    console.log('   Status:', verifyRes.statusCode);
    console.log('   Verification Code Present:', !!verifyRes.body.code);
    if (!verifyRes.body.code) {
      console.error('   ❌ FAILED: OTP verification did not return an auth exchange code!');
      success = false;
    } else {
      console.log('   ✅ SUCCESS: Verification succeeded and returned auth code.');
    }

    // 5. Test Code Exchange
    const code = verifyRes.body.code;
    console.log('\n5. Exchanging verification code for session token...');
    const exchangeRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/auth/exchange-code',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'edutrack.covenantsynergy.in'
      }
    }, { code });
    console.log('   Status:', exchangeRes.statusCode);
    console.log('   Session Token Present:', !!exchangeRes.body.access_token);
    console.log('   User Role:', exchangeRes.body.user?.role);
    console.log('   User Tenant ID:', exchangeRes.body.user?.tenantId);
    if (!exchangeRes.body.access_token || exchangeRes.body.user?.role !== 'SCHOOL_ADMIN') {
      console.error('   ❌ FAILED: Code exchange failed or returned invalid user payload!');
      success = false;
    } else {
      console.log('   ✅ SUCCESS: Exchanged code for valid session.');
    }

    // 6. Verify accessing protected route with tenant header
    const token = exchangeRes.body.access_token;
    const tenantId = exchangeRes.body.user.tenantId;
    console.log('\n6. Accessing protected setup status route...');
    const setupRes = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/tenant/setup-status',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Host': 'api-edutrack.covenantsynergy.in'
      }
    });
    console.log('   Status:', setupRes.statusCode);
    console.log('   School Setup Name:', setupRes.body.setup?.schoolName);
    console.log('   Current User Role:', setupRes.body.currentUser?.role);
    if (setupRes.statusCode !== 200 || setupRes.body.currentUser?.role !== 'SCHOOL_ADMIN') {
      console.error('   ❌ FAILED: Unauthorized or tenant boundary check failed on protected API route!');
      success = false;
    } else {
      console.log('   ✅ SUCCESS: Protected endpoint loaded successfully with correct tenant boundary validation.');
    }

  } catch (err) {
    console.error('   ❌ ERROR RUNNING TEST:', err.message);
    success = false;
  }

  if (success) {
    console.log('\n🎉 ALL VERIFICATIONS COMPLETED SUCCESSFULLY! cPanel migration is robust and ready.');
    process.exit(0);
  } else {
    console.error('\n❌ SOME VERIFICATIONS FAILED! Please check the output above.');
    process.exit(1);
  }
}

run();
