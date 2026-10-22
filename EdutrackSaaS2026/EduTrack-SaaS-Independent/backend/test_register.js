const axios = require('axios');
const BASE_URL = 'http://localhost:3001';

async function test() {
  try {
    const registerRes = await axios.post(`${BASE_URL}/tenant/register`, {
      schoolName: 'Oakridge International School',
      schoolType: 'School',
      adminName: 'Dr. Arvind Krishna',
      mobileNumber: '9988776655',
      email: 'admin@oakridge.edu',
      address: '456 Oakridge Avenue, Jubilee Hills, Hyderabad',
      academicYear: '2026-2027'
    });
    console.log("Success:", registerRes.data);
  } catch (err) {
    console.error("Full Error:", err);
  }
}
test();
