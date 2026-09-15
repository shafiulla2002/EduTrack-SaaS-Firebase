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
  '/students?page=1&limit=10',
  '/teachers?page=1&limit=10',
  '/academics/classes',
  '/expenses?page=1&limit=10',
  '/attendance/summary',
  '/leave-management/requests',
  '/communications/user-channels',
  '/complaint-box',
  '/exams'
];

async function runTest() {
  console.log('Testing ALL live endpoints against:', baseUrl);

  for (const ep of endpoints) {
    try {
      const start = Date.now();
      const res = await fetch(`${baseUrl}${ep}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': '7efea98d-04f0-4a02-95f0-e6d358fd17ae'
        }
      });
      const duration = Date.now() - start;
      const text = await res.text();
      console.log(`[${res.status}] ${ep} (${duration}ms) - ${text.slice(0, 100)}`);
    } catch (err) {
      console.error(`[ERROR] ${ep}:`, err.message);
    }
  }
}

runTest();
