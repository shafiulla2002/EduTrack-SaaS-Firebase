async function run() {
  try {
    const response = await fetch('http://localhost:3001/auth/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'demo-school'
      },
      body: JSON.stringify({
        phone: '7989725121',
        portal: 'admin'
      })
    });
    const data = await response.json();
    console.log('API Response:', data);
  } catch (error) {
    console.error('API Error:', error.message);
  }
}

run();
