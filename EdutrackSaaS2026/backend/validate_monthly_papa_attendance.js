const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CHAR_TO_STATUS = {
  P: 'PRESENT',
  A: 'ABSENT',
  L: 'LATE',
  E: 'EXCUSED',
};

async function main() {
  console.log('=== STARTING MONTHLY-WISE PAPA ATTENDANCE VALIDATION SUITE ===');

  const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

  // 1. Audit total counts
  const totalLegacyRecords = await prisma.attendance.count({ where: { tenantId: SHAFIULLA_TENANT_ID } });
  const totalSessions = await prisma.attendanceSession.count({ where: { tenantId: SHAFIULLA_TENANT_ID } });
  const totalMonthlyRecords = await prisma.monthlyAttendance.count({ where: { tenantId: SHAFIULLA_TENANT_ID } });

  console.log('\n--- DATA VOLUME AUDIT ---');
  console.log(`Legacy Individual Attendance Rows: ${totalLegacyRecords}`);
  console.log(`Attendance Sessions (Metadata): ${totalSessions}`);
  console.log(`New MonthlyAttendance Rows: ${totalMonthlyRecords}`);
  const rowReductionPercent = ((1 - (totalMonthlyRecords / totalLegacyRecords)) * 100).toFixed(2);
  console.log(`Measured Student Row Reduction: ${rowReductionPercent}%`);

  // 2. Fetch sample MonthlyAttendance records across different classes
  const sampleMonthlyRecords = await prisma.monthlyAttendance.findMany({
    where: { tenantId: SHAFIULLA_TENANT_ID },
    include: {
      student: { include: { user: true } },
      classSection: { include: { class: true, section: true } },
    },
    take: 50,
  });

  console.log(`\n--- VALIDATING PARITY ON ${sampleMonthlyRecords.length} SAMPLE MONTHLY RECORDS ---`);

  let totalDaysChecked = 0;
  let totalDaysMatched = 0;
  let mismatchCount = 0;

  for (const mRec of sampleMonthlyRecords) {
    const studentId = mRec.studentId;
    const monthStr = mRec.month; // e.g. "2026-06"
    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthNumStr, 10);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    // Fetch sessions in that month for student's classSection
    const sessions = await prisma.attendanceSession.findMany({
      where: {
        tenantId: SHAFIULLA_TENANT_ID,
        classSectionId: mRec.classSectionId,
        date: { gte: startDate, lte: endDate },
      },
      select: { id: true, date: true },
    });

    const sessionIds = sessions.map(s => s.id);

    // Fetch legacy explicit attendance logs for student in that month
    const legacyAbsents = await prisma.attendance.findMany({
      where: {
        tenantId: SHAFIULLA_TENANT_ID,
        studentId: studentId,
        attendanceSessionId: { in: sessionIds },
      },
      include: { attendanceSession: true },
    });

    const legacyMap = new Map(); // day (1-31) -> status
    for (const leg of legacyAbsents) {
      const day = new Date(leg.attendanceSession.date).getUTCDate();
      legacyMap.set(day, leg.status);
    }

    // Check each session day against PAPA string
    for (const sess of sessions) {
      const day = new Date(sess.date).getUTCDate();
      const dayIdx = day - 1;
      const papaChar = mRec.attendance[dayIdx];

      totalDaysChecked++;

      // Expected status from legacy DB
      const legacyStatus = legacyMap.get(day) || 'PRESENT'; // implicit present in EduTrack
      const papaStatus = CHAR_TO_STATUS[papaChar] || 'PRESENT';

      if (legacyStatus === papaStatus) {
        totalDaysMatched++;
      } else {
        mismatchCount++;
        console.error(`MISMATCH on Student ${mRec.student.user.name} (${mRec.classSection.class.name}-${mRec.classSection.section.name}) Date: ${yearStr}-${monthNumStr}-${day}: Legacy=${legacyStatus}, PAPA=${papaStatus}`);
      }
    }
  }

  const parityPercent = ((totalDaysMatched / totalDaysChecked) * 100).toFixed(2);

  console.log('\n==================================================');
  console.log('PARITY VALIDATION RESULT:');
  console.log(`Total Days Checked: ${totalDaysChecked}`);
  console.log(`Total Days Matched: ${totalDaysMatched}`);
  console.log(`Mismatches: ${mismatchCount}`);
  console.log(`BUSINESS DATA PARITY ACCURACY: ${parityPercent}%`);
  console.log('==================================================');
}

main()
  .catch(e => console.error('Validation failed:', e))
  .finally(() => prisma.$disconnect());
