const axios = require('axios');

async function testCors(url, origin) {
  console.log(`\n========================================`);
  console.log(`Testing URL: ${url}`);
  console.log(`Origin Header: ${origin}`);
  console.log(`========================================`);

  // 1. Test OPTIONS Preflight
  try {
    const optionsRes = await axios({
      method: 'OPTIONS',
      url: `${url}/auth/login`,
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Tenant-ID'
      },
      timeout: 10000
    });
    console.log('OPTIONS Preflight Status:', optionsRes.status);
    console.log('Access-Control-Allow-Origin:', optionsRes.headers['access-control-allow-origin']);
    console.log('Access-Control-Allow-Credentials:', optionsRes.headers['access-control-allow-credentials']);
    console.log('Access-Control-Allow-Methods:', optionsRes.headers['access-control-allow-methods']);
    console.log('Access-Control-Allow-Headers:', optionsRes.headers['access-control-allow-headers']);
  } catch (err) {
    if (err.response) {
      console.log('OPTIONS Error Status:', err.response.status, err.response.headers);
    } else {
      console.log('OPTIONS Network Error:', err.message);
    }
  }

  // 2. Test POST Request
  try {
    const postRes = await axios.post(`${url}/auth/login`, {
      email: 'superadmin@edutrack.com',
      password: 'SuperAdminPassword123!',
      targetPortal: 'PLATFORM'
    }, {
      headers: {
        'Origin': origin,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    console.log('\nPOST Login Status:', postRes.status);
    console.log('POST Access-Control-Allow-Origin:', postRes.headers['access-control-allow-origin']);
    console.log('User Authenticated:', postRes.data.user?.email, 'Role:', postRes.data.user?.role);
  } catch (err) {
    if (err.response) {
      console.log('POST Error Status:', err.response.status, err.response.data);
    } else {
      console.log('POST Network Error:', err.message);
    }
  }
}

async function main() {
  const origin = 'https://edutrack-platform-lac.vercel.app';
  await testCors('https://edutrack.covenantsynergy.in/api', origin);
}

main();
