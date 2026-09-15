const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = 'edutrack-super-secret-key-change-in-production-19823612';

const payload = {
  sub: '4f37d55e-239a-4b35-a3cb-dce2a7316737',
  id: '4f37d55e-239a-4b35-a3cb-dce2a7316737',
  email: 'shaikshafiulla2002@gmail.com',
  role: 'SCHOOL_ADMIN',
  tenantId: '7efea98d-04f0-4a02-95f0-e6d358fd17ae'
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

const baseUrl = 'https://edutrack-liveapi-app.vercel.app';

const endpoints = [
  '/dashboard/summary',
  '/tenant/setup-status',
  '/timetable/workload',
  '/billing/summary',
  '/students?page=1&limit=10'
];

async function runTest() {
  console.log('Testing WITHOUT x-tenant-id header:');

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, {
        headers: {
          'Authorization': `Bearer ${token}`
          // NO x-tenant-id
        }
      });
      const text = await res.text();
      console.log(`\nEndpoint: ${ep}`);
      console.log(`Status: ${res.status}`);
      console.log(`Body: ${text.slice(0, 500)}`);
    } catch (err) {
      console.error(`Endpoint ${ep} threw error:`, err);
    }
  }
}

runTest();
