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

  // Query sections for each class returned
  try {
    const classesRes = await axios.get('https://edu-track-saa-s-orcin.vercel.app/_backend/teacher-portal/attendance/classes', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });
    console.log("Classes response:", classesRes.data);

    for (const c of classesRes.data) {
      const sectionsRes = await axios.get(`https://edu-track-saa-s-orcin.vercel.app/_backend/teacher-portal/attendance/sections?classVal=${encodeURIComponent(c.value)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      console.log(`Sections response for ${c.value}:`, sectionsRes.data);
    }
  } catch (err) {
    console.error("Query failed:", err.response ? err.response.data : err.message);
  }
}

run();
