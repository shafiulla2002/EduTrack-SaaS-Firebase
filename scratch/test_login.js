const baseUrl = 'https://edutrack-liveapi-app.vercel.app';

async function testLogin() {
  const passwords = ['password123', 'Password@123', 'admin123', 'Shaik@123', '12345678', 'password'];
  for (const pw of passwords) {
    console.log(`Attempting login with email: shaikshafiulla2002@gmail.com and password: ${pw}...`);
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shaikshafiulla2002@gmail.com', password: pw })
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Body: ${text.slice(0, 300)}`);
    if (res.ok) {
      console.log('SUCCESS! Response:', text);
      break;
    }
  }
}

testLogin();
