const jwt = require('jsonwebtoken');

async function main() {
  const secret = 'edutrack-super-secret-key-change-in-production-19823612';
  const payload = {
    sub: '9aebd0e0-70e2-4fc8-aa76-2ae7c0e24f02',
    email: 'apexadmin_unique_123@example.com',
    role: 'SCHOOL_ADMIN',
    name: 'Apex Admin',
    tenantId: '9d2755a9-4529-4b30-9aa9-b6404c28d338'
  };

  const token = jwt.sign(payload, secret, { expiresIn: '15m' });
  console.log('Generated JWT Token:', token);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': 'apex-academy-123',
    'Content-Type': 'application/json'
  };

  try {
    const res = await fetch('http://localhost:3001/dashboard/summary', { headers });
    console.log('Status Code:', res.status);
    const data = await res.json();
    console.log('Response Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
