const axios = require('axios');
const jwt = require('jsonwebtoken');

// Secret from backend env (or fallback secret)
const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-change-this-in-production';

async function main() {
  const liveApiUrl = 'https://edutrack-liveapi-app.vercel.app';
  console.log(`Testing Live Vercel API at ${liveApiUrl}...`);

  const payload = {
    sub: '4f37d55e-239a-4b35-a3cb-dce2a7316737',
    id: '4f37d55e-239a-4b35-a3cb-dce2a7316737',
    email: 'shaikshafiulla2002@gmail.com',
    role: 'SCHOOL_ADMIN',
    tenantId: '7efea98d-04f0-4a02-95f0-e6d358fd17ae',
  };

  const token = jwt.sign(payload, secret, { expiresIn: '7d' });
  console.log('Generated JWT token:', token.substring(0, 30) + '...');

  const headers = { Authorization: `Bearer ${token}` };

  console.log('1. Testing GET /leave-management...');
  try {
    const leaveRes = await axios.get(`${liveApiUrl}/leave-management`, { headers });
    console.log('GET /leave-management SUCCESS:', leaveRes.status, 'Total items:', leaveRes.data?.data?.length ?? leaveRes.data?.length);
  } catch (err) {
    console.error('GET /leave-management ERROR:', err.response?.status, err.response?.data);
  }

  console.log('2. Testing GET /leave-management/stats...');
  try {
    const statsRes = await axios.get(`${liveApiUrl}/leave-management/stats`, { headers });
    console.log('GET /leave-management/stats SUCCESS:', statsRes.status, statsRes.data);
  } catch (err) {
    console.error('GET /leave-management/stats ERROR:', err.response?.status, err.response?.data);
  }

  console.log('3. Testing GET /attendance/dashboard...');
  try {
    const attRes = await axios.get(`${liveApiUrl}/attendance/dashboard`, { headers });
    console.log('GET /attendance/dashboard SUCCESS:', attRes.status);
  } catch (err) {
    console.error('GET /attendance/dashboard ERROR:', err.response?.status, err.response?.data);
  }
}

main();
