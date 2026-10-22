// Phase 4 Measurement Script: Teacher Section Endpoints
const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'edutrack-super-secret-key-change-in-production-19823612';
const API_BASE = 'http://localhost:3001/api';

async function runBenchmark() {
  console.log('--- PHASE 4 PERFORMANCE BENCHMARK ---');

  // Generate test admin token
  const token = jwt.sign({
    id: 'test-admin-id',
    email: 'admin@school.com',
    role: 'SCHOOL_ADMIN',
    tenantId: 'test-tenant-id'
  }, JWT_SECRET, { expiresIn: '1h' });

  const headers = { Authorization: `Bearer ${token}` };

  // 1. Navigation Flow Comparison
  console.log('\n1. Navigation Latency Simulation:');
  
  // A. Stale GET /teachers (Old prefetch)
  const t0_old = Date.now();
  try {
    const staleRes = await axios.get(`${API_BASE}/teachers`, { headers });
    const staleDuration = Date.now() - t0_old;
    console.log(`   [OLD PREFETCH] GET /teachers: ${staleDuration} ms (Wasted endpoint)`);
  } catch (err) {
    console.log(`   [OLD PREFETCH] GET /teachers error: ${err.message}`);
  }

  // B. Correct GET /timetable/workload/dashboard (New prefetch)
  const t0_dash = Date.now();
  let dashData;
  try {
    const dashRes = await axios.get(`${API_BASE}/timetable/workload/dashboard`, { headers });
    dashData = dashRes.data;
    const dashDuration = Date.now() - t0_dash;
    console.log(`   [NEW PREFETCH / MOUNT] GET /timetable/workload/dashboard: ${dashDuration} ms (Directly consumed)`);
    console.log(`   Workload Summary: ${dashData.summary?.totalTeachers || 0} teachers, ${dashData.summary?.totalClasses || 0} classes, ${dashData.summary?.totalAssignments || 0} assignments`);
  } catch (err) {
    console.log(`   [NEW PREFETCH / MOUNT] GET /timetable/workload/dashboard error: ${err.message}`);
  }

  const sampleTeacherId = dashData?.teachers?.[0]?.teacherId || 'sample-teacher-id';
  const sampleClassId = dashData?.classes?.[0]?.classSectionId || 'sample-class-id';

  // 2. Teacher Drawer Fetch Waterfall vs Concurrent
  console.log('\n2. Teacher Drawer Detail Fetch Simulation (teacherId: ' + sampleTeacherId + '):');
  
  // Sequential (OLD)
  const t0_seq = Date.now();
  try {
    const [wRes, pRes, lRes] = await Promise.all([
      axios.get(`${API_BASE}/timetable/workload/teacher/${sampleTeacherId}`, { headers }).catch(e => ({ data: {} })),
      axios.get(`${API_BASE}/timetable/teacher/${sampleTeacherId}/periods?gaps=true`, { headers }).catch(e => ({ data: [] })),
      axios.get(`${API_BASE}/timetable/teacher/${sampleTeacherId}/leaser-periods`, { headers }).catch(e => ({ data: [] }))
    ]);
    const sRes = await axios.get(`${API_BASE}/timetable/teachers/${sampleTeacherId}/skills`, { headers }).catch(e => ({ data: [] }));
    const seqDuration = Date.now() - t0_seq;
    console.log(`   [OLD SEQUENTIAL WATERFALL] Total duration: ${seqDuration} ms`);
  } catch (err) {
    console.log(`   Sequential test error: ${err.message}`);
  }

  // Concurrent (NEW)
  const t0_par = Date.now();
  try {
    const [wRes, pRes, lRes, sRes] = await Promise.all([
      axios.get(`${API_BASE}/timetable/workload/teacher/${sampleTeacherId}`, { headers }).catch(e => ({ data: {} })),
      axios.get(`${API_BASE}/timetable/teacher/${sampleTeacherId}/periods?gaps=true`, { headers }).catch(e => ({ data: [] })),
      axios.get(`${API_BASE}/timetable/teacher/${sampleTeacherId}/leaser-periods`, { headers }).catch(e => ({ data: [] })),
      axios.get(`${API_BASE}/timetable/teachers/${sampleTeacherId}/skills`, { headers }).catch(e => ({ data: [] }))
    ]);
    const parDuration = Date.now() - t0_par;
    console.log(`   [NEW CONCURRENT PROMISE.ALL] Total duration: ${parDuration} ms`);
    console.log(`   Speedup: ~${Math.round(((t0_par - t0_seq) / t0_seq) * 100)}% latency reduction`);
  } catch (err) {
    console.log(`   Concurrent test error: ${err.message}`);
  }

  // 3. Class Drawer Fetch
  console.log('\n3. Class Section Drawer Detail Fetch (classSectionId: ' + sampleClassId + '):');
  const t0_class = Date.now();
  try {
    const [cWorkloadRes, cPeriodsRes] = await Promise.all([
      axios.get(`${API_BASE}/timetable/workload/class-section/${sampleClassId}`, { headers }).catch(e => ({ data: {} })),
      axios.get(`${API_BASE}/timetable/class/${sampleClassId}/periods`, { headers }).catch(e => ({ data: [] }))
    ]);
    const classDuration = Date.now() - t0_class;
    console.log(`   Class Drawer Concurrent Fetch: ${classDuration} ms`);
  } catch (err) {
    console.log(`   Class drawer test error: ${err.message}`);
  }

  console.log('\n--- BENCHMARK COMPLETE ---');
}

runBenchmark().catch(console.error);
