const axios = require('axios');

async function run() {
  const phone = '9642402639';
  console.log("1. Sending OTP to phone:", phone);
  let loginResult;

  try {
    const otpRes = await axios.post('https://edu-track-saa-s-orcin.vercel.app/_backend/auth/send-otp', { phone });
    console.log("OTP Sent. Status:", otpRes.status);
    console.log("Dev OTP Code from response:", otpRes.data.otpCode);
    const otpCode = otpRes.data.otpCode || '123456';

    console.log("2. Verifying OTP...");
    const verifyRes = await axios.post('https://edu-track-saa-s-orcin.vercel.app/_backend/auth/verify-otp', {
      phone,
      otpCode
    });
    console.log("OTP Verified. Status:", verifyRes.status);
    loginResult = verifyRes.data;
  } catch (err) {
    console.error("Auth flow failed:", err.response ? err.response.data : err.message);
    return;
  }

  const token = loginResult.access_token;
  const tenantId = loginResult.user.tenantId;
  console.log("Auth Success. Token length:", token.length, "Tenant ID:", tenantId);

  // Now query the workload APIs on the live Vercel backend!
  const endpoints = [
    '/timetable/workload/summary',
    '/timetable/workload/teachers',
    '/timetable/workload/classes',
    '/timetable/subjects',
    '/academics/academic-years',
    '/academics/sections'
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(`https://edu-track-saa-s-orcin.vercel.app/_backend${ep}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      console.log(`EP ${ep} Status: ${res.status}, data:`, Array.isArray(res.data) ? `Array of size ${res.data.length}` : res.data);
    } catch (err) {
      console.error(`EP ${ep} failed:`, err.response ? err.response.data : err.message);
    }
  }
}

run();
