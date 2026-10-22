const axios = require('axios');

async function run() {
  const phone = '9060020002'; // Baskar Don phone
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

  // Query classes via Next.js proxy route /api
  try {
    const classesRes = await axios.get('https://edu-track-saa-s-orcin.vercel.app/api/teacher-portal/attendance/classes', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });
    console.log("Next.js proxy classes response:", classesRes.data);
  } catch (err) {
    console.error("Proxy classes query failed:", err.response ? err.response.data : err.message);
  }

  // Query sections via Next.js proxy route /api
  try {
    const sectionsRes = await axios.get('https://edu-track-saa-s-orcin.vercel.app/api/teacher-portal/attendance/sections?classVal=Class-2', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });
    console.log("Next.js proxy sections response for Class-2:", sectionsRes.data);
  } catch (err) {
    console.error("Proxy sections query failed:", err.response ? err.response.data : err.message);
  }
}

run();
