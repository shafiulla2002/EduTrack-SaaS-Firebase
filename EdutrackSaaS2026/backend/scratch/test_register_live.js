const axios = require('axios');

async function testRegister() {
  try {
    const res = await axios.post('https://edutrack-liveapi-app.vercel.app/tenant/register', {
      schoolName: 'Shafiulla High School',
      schoolType: 'School',
      adminName: 'Shaik Shafiulla',
      mobileNumber: '9642402639',
      email: 'shaikshafiulla2002@gmail.com',
      address: 'Hyderabad',
      academicYear: '2026-2027',
      subscriptionPlan: 'TRIAL'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://edutrack-frontend-live.vercel.app'
      }
    });

    console.log('Registration Success Response:', res.data);
  } catch (err) {
    if (err.response) {
      console.error('Registration Error Status:', err.response.status, err.response.data);
    } else {
      console.error('Registration Error:', err.message);
    }
  }
}

testRegister();
