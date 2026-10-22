const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = 'edutrack-super-secret-key-change-in-production-19823612';
const API_BASE = 'https://edutrack-liveapi-app.vercel.app';
const FRONTEND_BASE = 'https://edutrack-live-app.vercel.app';

function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const timings = {
      dnsStart: 0,
      dnsEnd: 0,
      tcpStart: 0,
      tcpEnd: 0,
      tlsStart: 0,
      tlsEnd: 0,
      reqStart: 0,
      firstByte: 0,
      end: 0,
      dns: 0,
      tcp: 0,
      tls: 0,
      ttfb: 0,
      download: 0,
      total: 0,
      status: 0,
      headers: {},
      bodyLength: 0,
      body: ''
    };

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const start = performance.now();
    timings.reqStart = start;

    const req = (url.protocol === 'https:' ? https : http).request(reqOptions, (res) => {
      timings.firstByte = performance.now();
      timings.ttfb = timings.firstByte - start;
      timings.status = res.statusCode;
      timings.headers = res.headers;

      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        timings.end = performance.now();
        timings.total = timings.end - start;
        timings.download = timings.end - timings.firstByte;
        timings.bodyLength = Buffer.byteLength(body);
        timings.body = body;
        resolve(timings);
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => {
        timings.dnsEnd = performance.now();
        timings.dns = timings.dnsEnd - start;
      });
      socket.on('connect', () => {
        timings.tcpEnd = performance.now();
        timings.tcp = timings.tcpEnd - (timings.dnsEnd || start);
      });
      socket.on('secureConnect', () => {
        timings.tlsEnd = performance.now();
        timings.tls = timings.tlsEnd - (timings.tcpEnd || start);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('CRITICAL PRODUCTION PERFORMANCE RECONCILIATION AUDIT');
  console.log('====================================================\n');

  // 1. Get user & token
  const user = await prisma.user.findFirst({
    where: { 
      role: { in: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] },
      isActive: true
    },
    include: { tenant: true }
  });

  if (!user) {
    console.error('Admin user not found!');
    return;
  }

  const token = jwt.sign({
    sub: user.id,
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    schoolName: user.tenant?.name || 'A.P. Greenwood School'
  }, JWT_SECRET, { expiresIn: '7d' });

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': user.tenantId,
    'Accept': 'application/json'
  };

  console.log(`Testing Tenant: ${user.tenantId} (${user.tenant?.name})`);
  console.log(`Backend Target: ${API_BASE}`);
  console.log(`Frontend Target: ${FRONTEND_BASE}\n`);

  // TEST 2.1: Single Cold Request to /students
  console.log('--- TEST 2.1: Initial /students Request ---');
  const t1 = await httpRequest(`${API_BASE}/students?page=1&limit=20`, { headers: authHeaders });
  console.log(`Status: ${t1.status}`);
  console.log(`DNS: ${t1.dns.toFixed(1)}ms | TCP: ${t1.tcp.toFixed(1)}ms | TLS: ${t1.tls.toFixed(1)}ms | TTFB: ${t1.ttfb.toFixed(1)}ms | Download: ${t1.download.toFixed(1)}ms | Total: ${t1.total.toFixed(1)}ms`);
  console.log(`Vercel Cache: ${t1.headers['x-vercel-cache'] || 'N/A'}`);
  console.log(`Vercel ID: ${t1.headers['x-vercel-id'] || 'N/A'}`);
  console.log(`Response Bytes: ${t1.bodyLength}\n`);

  // Verify response content for consolidated searchStudents
  let parsed;
  try {
    parsed = JSON.parse(t1.body);
    console.log(`Data count: ${parsed.data ? parsed.data.length : 'N/A'}, Total: ${parsed.total}, Page: ${parsed.page}`);
    if (parsed.data && parsed.data[0]) {
      console.log(`Sample Student: ${parsed.data[0].name}, Roll: ${parsed.data[0].rollNo}, Paid: ${parsed.data[0].paidAmount}, Due: ${parsed.data[0].balanceDue}, Status: ${parsed.data[0].financialStatus}`);
    }
  } catch (e) {
    console.log('Response body preview:', t1.body.substring(0, 300));
  }

  // TEST 2.2: 3 Sequential Warm Requests
  console.log('\n--- TEST 2.2: 3 Sequential Warm Requests to /students ---');
  const warmResults = [];
  for (let i = 1; i <= 3; i++) {
    const tw = await httpRequest(`${API_BASE}/students?page=1&limit=20`, { headers: authHeaders });
    warmResults.push(tw);
    console.log(`Warm #${i}: Status ${tw.status} | TTFB: ${tw.ttfb.toFixed(1)}ms | Total: ${tw.total.toFixed(1)}ms | Vercel ID: ${tw.headers['x-vercel-id']}`);
  }
  const avgWarm = warmResults.reduce((a, b) => a + b.total, 0) / warmResults.length;
  console.log(`Average Warm Latency: ${avgWarm.toFixed(1)}ms\n`);

  // TEST 2.3: 5 Concurrent Requests
  console.log('--- TEST 2.3: 5 Concurrent Requests to /students ---');
  const start5 = performance.now();
  const promises5 = Array.from({ length: 5 }, (_, i) => 
    httpRequest(`${API_BASE}/students?page=${(i % 3) + 1}&limit=20`, { headers: authHeaders })
  );
  const results5 = await Promise.all(promises5);
  const end5 = performance.now();
  results5.forEach((r, i) => {
    console.log(`Req 5.${i + 1}: Status ${r.status} | TTFB: ${r.ttfb.toFixed(1)}ms | Total: ${r.total.toFixed(1)}ms`);
  });
  console.log(`5 Concurrent Total Time: ${(end5 - start5).toFixed(1)}ms | Avg Req: ${(results5.reduce((a, b) => a + b.total, 0) / 5).toFixed(1)}ms\n`);

  // TEST 2.4: 10 Concurrent Requests (Multi-endpoint simulation)
  console.log('--- TEST 2.4: 10 Concurrent Requests (Students + Academics + Setup + Timetable) ---');
  const urls = [
    `${API_BASE}/students?page=1&limit=20`,
    `${API_BASE}/students?page=2&limit=20`,
    `${API_BASE}/academics/academic-years`,
    `${API_BASE}/academics/classes`,
    `${API_BASE}/academics/sections`,
    `${API_BASE}/tenant/setup-status`,
    `${API_BASE}/timetable/academic-years`,
    `${API_BASE}/timetable/subjects`,
    `${API_BASE}/timetable/teachers`,
    `${API_BASE}/students?page=3&limit=20`
  ];
  const start10 = performance.now();
  const results10 = await Promise.all(urls.map(url => httpRequest(url, { headers: authHeaders })));
  const end10 = performance.now();
  let errorsCount = 0;
  results10.forEach((r, i) => {
    const u = new URL(urls[i]).pathname;
    if (r.status >= 400) errorsCount++;
    console.log(`Req 10.${i + 1} (${u}): Status ${r.status} | TTFB: ${r.ttfb.toFixed(1)}ms | Total: ${r.total.toFixed(1)}ms`);
  });
  console.log(`10 Concurrent Total Time: ${(end10 - start10).toFixed(1)}ms | Errors: ${errorsCount}\n`);

  // Direct Database Query Benchmark (to isolate DB vs Backend vs Network)
  console.log('--- TEST 3: Direct Database vs Direct CTE Execution ---');
  const dbStart = performance.now();
  const rawSqlResult = await prisma.$queryRawUnsafe(`
    WITH student_base AS (
      SELECT 
        sp.id AS "studentId",
        sp."rollNo",
        sp."fatherName",
        sp."motherName",
        sp."fatherPhone",
        sp."motherPhone",
        sp."guardianPhone",
        sp."aadharNo",
        sp."profilePhotoUrl",
        sp."classSectionId",
        sp."tenantId",
        u.id AS "userId",
        u.name AS "userName",
        u.email AS "userEmail",
        u.phone AS "userPhone",
        cs."classId",
        cs."sectionId",
        c.name AS "className",
        c."academicYearId" AS "academicYearId",
        s.name AS "sectionName"
      FROM "StudentProfile" sp
      JOIN "User" u ON sp."userId" = u.id
      LEFT JOIN "ClassSection" cs ON sp."classSectionId" = cs.id
      LEFT JOIN "Class" c ON cs."classId" = c.id
      LEFT JOIN "Section" s ON cs."sectionId" = s.id
      WHERE u."tenantId" = $1 AND u."isActive" = true
    ),
    counted AS (
      SELECT COUNT(*)::int AS "totalCount" FROM student_base
    ),
    paged_students AS (
      SELECT * FROM student_base
      ORDER BY "userName" ASC, "studentId" ASC
      LIMIT 20 OFFSET 0
    )
    SELECT 
      ps.*,
      c."totalCount"
    FROM paged_students ps
    CROSS JOIN counted c;
  `, user.tenantId);
  const dbEnd = performance.now();
  console.log(`Direct CTE Query via Prisma: ${(dbEnd - dbStart).toFixed(1)}ms | Rows: ${rawSqlResult.length}`);

  // Test Frontend Document Delivery & Cache
  console.log('\n--- TEST 1: Frontend Document Response ---');
  const frontRes = await httpRequest(`${FRONTEND_BASE}/dashboard/students`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  console.log(`Frontend Document: Status ${frontRes.status} | TTFB: ${frontRes.ttfb.toFixed(1)}ms | Total: ${frontRes.total.toFixed(1)}ms | Size: ${frontRes.bodyLength} bytes`);
  console.log(`Vercel Edge Cache: ${frontRes.headers['x-vercel-cache'] || 'N/A'}`);
  console.log(`Vercel Region ID: ${frontRes.headers['x-vercel-id'] || 'N/A'}`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
