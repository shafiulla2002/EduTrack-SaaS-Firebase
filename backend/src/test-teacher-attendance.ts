import { PrismaClient, Role, TeacherAttendanceStatus } from '@prisma/client';
import { TeacherAttendanceService } from './teacher-attendance/teacher-attendance.service';
import { isWithinGeofence } from './teacher-attendance/utils/geofence.util';

const prisma = new PrismaClient();
const service = new TeacherAttendanceService(prisma as any);

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING TEACHER ATTENDANCE SYSTEM TESTS');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Setup Test Tenants and Users
    console.log('1. Setting up test tenants and teachers...');
    const tenantA = await prisma.tenant.upsert({
      where: { subDomain: 'test-school-alpha-2027' },
      update: {},
      create: {
        name: 'Alpha International Academy',
        subDomain: 'test-school-alpha-2027',
      },
    });

    const tenantB = await prisma.tenant.upsert({
      where: { subDomain: 'test-school-beta-2027' },
      update: {},
      create: {
        name: 'Beta Cambridge High School',
        subDomain: 'test-school-beta-2027',
      },
    });

    const adminUserA = await prisma.user.upsert({
      where: { email: 'admin.alpha@test.com' },
      update: { tenantId: tenantA.id },
      create: {
        email: 'admin.alpha@test.com',
        passwordHash: 'dummyhash',
        name: 'Principal Alpha',
        role: Role.SCHOOL_ADMIN,
        tenantId: tenantA.id,
      },
    });

    const teacherUserA = await prisma.user.upsert({
      where: { email: 'teacher.alpha@test.com' },
      update: { tenantId: tenantA.id },
      create: {
        email: 'teacher.alpha@test.com',
        passwordHash: 'dummyhash',
        name: 'Dr. John Alpha',
        role: Role.TEACHER,
        tenantId: tenantA.id,
      },
    });

    const staffProfileA = await prisma.staffProfile.upsert({
      where: { userId: teacherUserA.id },
      update: { tenantId: tenantA.id },
      create: {
        userId: teacherUserA.id,
        tenantId: tenantA.id,
        employeeId: 'EMP-ALPHA-01',
        designation: 'Senior Science Teacher',
        staffCategory: 'TEACHING',
      },
    });

    const teacherUserB = await prisma.user.upsert({
      where: { email: 'teacher.beta@test.com' },
      update: { tenantId: tenantB.id },
      create: {
        email: 'teacher.beta@test.com',
        passwordHash: 'dummyhash',
        name: 'Prof. Mary Beta',
        role: Role.TEACHER,
        tenantId: tenantB.id,
      },
    });

    const staffProfileB = await prisma.staffProfile.upsert({
      where: { userId: teacherUserB.id },
      update: { tenantId: tenantB.id },
      create: {
        userId: teacherUserB.id,
        tenantId: tenantB.id,
        employeeId: 'EMP-BETA-01',
        designation: 'Mathematics Teacher',
        staffCategory: 'TEACHING',
      },
    });

    // Clean any prior attendance test data and QR codes to ensure deterministic tests
    const todayDate = new Date(`${new Date().toISOString().split('T')[0]}T00:00:00.000Z`);
    await prisma.teacherAttendance.deleteMany({
      where: {
        tenantId: { in: [tenantA.id, tenantB.id] },
      },
    });
    await prisma.teacherAttendanceAuditLog.deleteMany({
      where: {
        tenantId: { in: [tenantA.id, tenantB.id] },
      },
    });
    await prisma.teacherAttendanceQrCode.deleteMany({
      where: {
        tenantId: { in: [tenantA.id, tenantB.id] },
      },
    });

    // TEST 1: Admin generates QR Code for Tenant A
    console.log('\n2. Testing QR Code Generation & Retrieval...');
    const genResultA = await service.generateQr(adminUserA.id, tenantA.id, {
      requiresLocation: false,
    });
    assert(!!genResultA.qrCode, 'Admin can generate Teacher Attendance QR for Tenant A');
    assert(genResultA.qrCode?.status === 'ACTIVE', 'Generated QR status is ACTIVE');
    assert(genResultA.qrCode?.tenantId === tenantA.id, 'Generated QR belongs to Tenant A');
    const qrTokenA = genResultA.qrCode!.code;

    // TEST 2: Active QR retrieval
    const activeQrA = await service.getActiveQr(tenantA.id);
    assert(activeQrA.qrCode?.code === qrTokenA, 'Active QR retrieves matching token');

    // TEST 3: Teacher A scans Tenant A QR (Expected: SUCCESS)
    console.log('\n3. Testing Valid Attendance Scan...');
    const scanResult1 = await service.scanAndRecordAttendance(
      { id: teacherUserA.id, sub: teacherUserA.id, tenantId: tenantA.id, role: 'TEACHER', name: teacherUserA.name },
      { token: qrTokenA, scanSource: 'IN_APP_SCANNER' },
    );
    assert(scanResult1.success === true, 'Teacher A can scan Tenant A QR successfully');
    assert(scanResult1.alreadyMarked === false, 'First scan records new attendance');
    assert(scanResult1.attendance?.teacherName === 'Dr. John Alpha', 'Attendance records correct teacher');

    // TEST 4: Duplicate Scan Prevention (Expected: Handled as ALREADY_MARKED, no 2nd row)
    console.log('\n4. Testing Duplicate Scan Prevention...');
    const scanResultDup = await service.scanAndRecordAttendance(
      { id: teacherUserA.id, sub: teacherUserA.id, tenantId: tenantA.id, role: 'TEACHER', name: teacherUserA.name },
      { token: qrTokenA, scanSource: 'IN_APP_SCANNER' },
    );
    assert(scanResultDup.success === true, 'Duplicate scan handled gracefully');
    assert(scanResultDup.alreadyMarked === true, 'Duplicate scan flagged as alreadyMarked = true');

    const totalRecordsA = await prisma.teacherAttendance.count({
      where: { tenantId: tenantA.id, teacherId: staffProfileA.id, attendanceDate: todayDate },
    });
    assert(totalRecordsA === 1, 'Database contains exactly 1 attendance record for today (No duplicates)');

    // TEST 5: MULTI-TENANCY ISOLATION (Teacher B scans Tenant A QR -> MUST BE REJECTED)
    console.log('\n5. Testing Multi-Tenant Boundary Enforcement...');
    let tenantMismatchBlocked = false;
    try {
      await service.scanAndRecordAttendance(
        { id: teacherUserB.id, sub: teacherUserB.id, tenantId: tenantB.id, role: 'TEACHER', name: teacherUserB.name },
        { token: qrTokenA, scanSource: 'IN_APP_SCANNER' },
      );
    } catch (err: any) {
      if (err.message && err.message.includes('belongs to a different school')) {
        tenantMismatchBlocked = true;
      }
    }
    assert(tenantMismatchBlocked, 'Teacher from Tenant B scanning Tenant A QR is strictly REJECTED (Tenant Mismatch)');

    // TEST 6: Invalid / Fake QR Scan
    console.log('\n6. Testing Invalid QR Token...');
    let invalidQrBlocked = false;
    try {
      await service.scanAndRecordAttendance(
        { id: teacherUserA.id, sub: teacherUserA.id, tenantId: tenantA.id, role: 'TEACHER', name: teacherUserA.name },
        { token: 'invalid_fake_qr_code_xyz', scanSource: 'IN_APP_SCANNER' },
      );
    } catch (err: any) {
      if (err.message && err.message.includes('not a valid CS EduTrack')) {
        invalidQrBlocked = true;
      }
    }
    assert(invalidQrBlocked, 'Fake / non-existent QR token is REJECTED');

    // TEST 7: QR Regeneration & Invalidation of Old QR
    console.log('\n7. Testing QR Regeneration & Revocation...');
    const regenResult = await service.regenerateQr(adminUserA.id, tenantA.id);
    assert(regenResult.qrCode?.version === 2, 'Regenerated QR has incremented version (2)');
    assert(regenResult.qrCode?.code !== qrTokenA, 'Regenerated QR has new unique token');

    let oldQrBlocked = false;
    try {
      // Try scanning with previous (now REVOKED) QR token
      await service.scanAndRecordAttendance(
        { id: teacherUserA.id, sub: teacherUserA.id, tenantId: tenantA.id, role: 'TEACHER', name: teacherUserA.name },
        { token: qrTokenA, scanSource: 'IN_APP_SCANNER' },
      );
    } catch (err: any) {
      if (err.message && err.message.includes('no longer active')) {
        oldQrBlocked = true;
      }
    }
    assert(oldQrBlocked, 'Revoked older QR code is strictly REJECTED (no longer active)');

    // TEST 8: Geofence Validation
    console.log('\n8. Testing Geofencing Security...');
    const schoolLat = 18.5204;
    const schoolLon = 73.8567;
    const closeLat = 18.5205; // ~15 meters away
    const closeLon = 73.8568;
    const farLat = 18.6000; // ~9 km away
    const farLon = 73.9000;

    const geoCheckClose = isWithinGeofence(closeLat, closeLon, schoolLat, schoolLon, 150);
    assert(geoCheckClose.within === true, `Teacher within 150m is accepted (Distance: ${geoCheckClose.distanceMeters}m)`);

    const geoCheckFar = isWithinGeofence(farLat, farLon, schoolLat, schoolLon, 150);
    assert(geoCheckFar.within === false, `Teacher 9km away is rejected (Distance: ${geoCheckFar.distanceMeters}m)`);

    // TEST 9: Admin Attendance Dashboard
    console.log('\n9. Testing Admin Dashboard & Teacher History...');
    const adminToday = await service.getAdminTodayAttendance(tenantA.id);
    assert(adminToday.kpis.totalTeachers >= 1, 'Admin today report counts total teachers');
    assert(
      (adminToday.kpis.presentCount + adminToday.kpis.lateCount) >= 1,
      `Admin today report reflects marked attendance (Present: ${adminToday.kpis.presentCount}, Late: ${adminToday.kpis.lateCount})`,
    );
    assert(adminToday.teachers.some((t) => t.name === 'Dr. John Alpha'), 'Teacher list includes Dr. John Alpha');

    // TEST 10: Teacher Personal History & Audit Trail
    const myHistory = await service.getMyAttendanceHistory(teacherUserA.id, tenantA.id);
    assert(myHistory.records.length >= 1, 'Teacher can view personal attendance history');
    assert(
      (myHistory.summary.presentDays + myHistory.summary.lateDays) >= 1,
      `Monthly summary computes marked days correctly (Present: ${myHistory.summary.presentDays}, Late: ${myHistory.summary.lateDays})`,
    );

    const auditLogs = await service.getAuditLogs(tenantA.id);
    assert(auditLogs.length >= 3, 'Audit logs record scan success, rejected scans, and QR generation');

  } catch (error: any) {
    console.error('Unexpected test failure:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n========================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
