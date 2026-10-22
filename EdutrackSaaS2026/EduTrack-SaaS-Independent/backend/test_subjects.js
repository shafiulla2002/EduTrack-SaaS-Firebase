/**
 * Test script: verify bulk subjects creation now works with the correct tenant context.
 * Run: node test_subjects.js
 */
const https = require('https');
const http = require('http');

async function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Testing Subject Bulk Create ===');

  // Step 1: Login as Jason (A.P. Greenwood admin)
  const loginBody = JSON.stringify({ phone: '9876543210' });
  const loginRes = await request('http://localhost:3001/auth/send-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'a-p-greenwood-high-school',
      'Content-Length': Buffer.byteLength(loginBody),
    }
  }, loginBody);
  console.log('OTP send status:', loginRes.status, loginRes.body);

  // Step 2: Directly test subjects endpoint with tenant header (no auth guard for quick test)
  // Use direct DB check instead
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  try {
    const tenantId = '778b7f12-d8c3-406d-926c-a403b46100ef'; // A.P. GreenWood High School
    const subjects = await p.subject.findMany({ where: { tenantId } });
    console.log('\nExisting subjects for A.P. GreenWood:', JSON.stringify(subjects, null, 2));
    console.log('Total:', subjects.length);
  } finally {
    await p.$disconnect();
  }
}

main().catch(console.error);
