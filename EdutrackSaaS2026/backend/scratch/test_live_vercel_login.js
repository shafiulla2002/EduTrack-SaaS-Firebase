const axios = require('axios');

async function testBackend(url) {
  console.log(`\nTesting POST ${url}/auth/login...`);
  try {
    const res = await axios.post(`${url}/auth/login`, {
      email: 'superadmin@edutrack.com',
      password: 'SuperAdminPassword123!',
      targetPortal: 'PLATFORM'
    }, {
      timeout: 10000
    });
    console.log('STATUS:', res.status);
    console.log('DATA:', res.data);
  } catch (err) {
    if (err.response) {
      console.log('HTTP ERROR:', err.response.status, err.response.data);
    } else {
      console.log('NETWORK/DNS ERROR:', err.message);
    }
  }
}

async function run() {
  await testBackend('https://edu-track-saa-jzv5hb2yt-shafiulla90s-projects.vercel.app/api');
  await testBackend('https://edutrack.covenantsynergy.in/api');
}

run();
