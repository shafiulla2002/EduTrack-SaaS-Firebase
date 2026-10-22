const axios = require('axios');
const BASE_URL = 'http://localhost:3001';

async function test() {
  try {
    const res = await axios.get(`${BASE_URL}/academics/academic-years`);
    console.log("Response:", res.data);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
