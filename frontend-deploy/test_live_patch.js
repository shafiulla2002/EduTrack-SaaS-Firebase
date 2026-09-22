const axios = require('axios');

async function run() {
  const phone = '9642402639';
  console.log("1. Sending OTP to phone:", phone);
  let loginResult;

  try {
    const otpRes = await axios.post('https://edu-track-saas-orcin.vercel.app/api/auth/send-otp', { phone });
    const otpCode = otpRes.data.otpCode || '123456';

    console.log("2. Verifying OTP...");
    const verifyRes = await axios.post('https://edu-track-saas-orcin.vercel.app/api/auth/verify-otp', {
      phone,
      otpCode
    });
    loginResult = verifyRes.data;
  } catch (err) {
    console.error("Auth flow failed:", err.response ? err.response.data : err.message);
    return;
  }

  const token = loginResult.access_token;
  const tenantId = loginResult.user.tenantId;
  console.log("Auth Success. Token length:", token.length, "Tenant ID:", tenantId);

  // Let's find Amarnath Verma's ID on the live server
  console.log("3. Fetching student list to find Amarnath...");
  let studentId;
  try {
    const studentsRes = await axios.get('https://edu-track-saas-orcin.vercel.app/api/students', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });
    const amarnath = studentsRes.data.find(s => s.user?.name.includes('Amarnath'));
    if (!amarnath) {
      console.log("Amarnath Verma not found on live server.");
      return;
    }
    studentId = amarnath.id;
    console.log(`Found Amarnath Verma on live server. Student ID: ${studentId}, Email: ${amarnath.user?.email}`);
  } catch (err) {
    console.error("Failed to fetch students:", err.response ? err.response.data : err.message);
    return;
  }

  // 4. Let's try to update his email to amarnathv@example.com (original) or amarnath.v@example.com
  const newEmail = 'amarnathv@example.com';
  console.log(`4. Attempting to PATCH student ${studentId} with email ${newEmail}...`);
  try {
    const patchRes = await axios.patch(`https://edu-track-saas-orcin.vercel.app/api/students/${studentId}`, {
      email: newEmail,
      rollNo: "2",
      name: "Amarnath Verma",
      fatherName: "Rajesh Verma",
      motherName: "Anita Verma",
      aadharNo: "888888888888"
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });
    console.log("PATCH Success. Response status:", patchRes.status, "data:", patchRes.data);
  } catch (err) {
    console.error("PATCH Failed. Status:", err.response ? err.response.status : 'None');
    console.error("Response data:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}

run();
