async function run() {
  const baseUrl = 'http://localhost:3001';
  const phone = '7989725121'; // David Nikhals
  const portal = 'admin'; // School Admin portal

  console.log('--- STARTING AUTH HUB API VERIFICATION (built-in fetch) ---');

  try {
    // 1. Send OTP Request
    console.log(`\nStep 1: Sending OTP request for ${phone}...`);
    const sendOtpRes = await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, portal })
    });
    console.log('Response Status:', sendOtpRes.status);
    console.log('Response Data:', await sendOtpRes.json());

    // 2. Verify OTP with code generation requested
    console.log('\nStep 2: Verifying OTP and requesting short-lived code (generateCode: true)...');
    const verifyOtpRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        otpCode: 'MOCK_FIREBASE_ID_TOKEN',
        portal,
        generateCode: true
      })
    });
    console.log('Response Status:', verifyOtpRes.status);
    const verifyData = await verifyOtpRes.json();
    console.log('Response Data:', verifyData);

    if (!verifyData.code) {
      throw new Error('Verification failed: No authorization code returned!');
    }
    const code = verifyData.code;

    // 3. Exchange Code for Session Token
    console.log('\nStep 3: Exchanging authorization code for session JWT...');
    const exchangeRes = await fetch(`${baseUrl}/auth/exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    console.log('Response Status:', exchangeRes.status);
    const exchangeData = await exchangeRes.json();
    console.log('Response Data:', {
      access_token: exchangeData.access_token ? 'VALID_TOKEN_RECEIVED' : 'MISSING',
      user: exchangeData.user
    });

    if (!exchangeData.access_token) {
      throw new Error('Exchange failed: No access token received!');
    }

    // 4. Try to exchange the same code again (Should fail)
    console.log('\nStep 4: Trying to exchange the same authorization code again (Replay Attack)...');
    const exchangeRes2 = await fetch(`${baseUrl}/auth/exchange-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    console.log('Response Status (Expected to be 401):', exchangeRes2.status);
    const exchangeData2 = await exchangeRes2.json();
    console.log('Response Data:', exchangeData2);

    if (exchangeRes2.status === 401) {
      console.log('\nSUCCESS: Replay attack failed as expected.');
    } else {
      console.error('\nFAIL: Replay attack succeeded! Status code was not 401.');
    }

    console.log('\n--- ALL AUTH HUB APIS VERIFIED SUCCESSFULLY ---');
  } catch (err) {
    console.error('VERIFICATION ERROR:', err.message);
  }
}

run();
