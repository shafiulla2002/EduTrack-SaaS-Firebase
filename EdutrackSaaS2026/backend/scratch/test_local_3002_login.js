const axios = require('axios');

async function testLocal3002() {
  console.log('Testing POST http://localhost:3002/api/auth/login...');
  try {
    const res = await axios.post('http://localhost:3002/api/auth/login', {
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
      console.log('HTTP ERROR STATUS:', err.response.status);
      console.log('HTTP ERROR DATA:', err.response.data);
    } else {
      console.log('NETWORK ERROR:', err.message);
    }
  }
}

testLocal3002();
