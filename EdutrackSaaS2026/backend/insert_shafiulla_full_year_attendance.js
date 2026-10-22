const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

const ABSENT_REASONS = [
  'Fever & High Temperature',
  'Family Event / Function',
  'Out of Station',
  'Severe Cold & Cough',
  'Doctor Appointment',
  'Personal Reasons',
  'Unwell / Sick Leave',
  'Stomach Ache'
];

function isHoliday(date) {
  if (date.getDay() === 0) return true;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  // Dussehra Break: Oct 14 - Oct 24, 2026
  if (year === 2026 && month === 10 && day >= 14 && day <= 24) return true;

  // Deepavali: Nov 8, 2026
  if (year === 2026 && month === 11 && day === 8) return true;

  // Winter / Christmas Break: Dec 25, 2026 - Jan 1, 2027
  if ((year === 2026 && month === 12 && day >= 25) || (year === 2027 && month === 1 && day === 1)) return true;

  // Sankranti Break: Jan 13 - Jan 17, 2027
  if (year === 2027 && month === 1 && day >= 13 && day <= 17) return true;

  // Republic Day: Jan 26, 2027
  if (year === 2027 && month === 1 && day === 26) return true;

  // Holi: Mar 22, 2027
  if (year === 2027 && month === 3 && day === 22) return true;

  return false;
}

function getStudentAttendanceStatus(studentId, dateStr) {
  let hash = 0;
  const str = `${studentId}-${dateStr}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100;

  if (val < 93) {
    return { status: 'PRESENT', reason: null };
  } else if (val < 97) {
    const reasonIdx = Math.abs(hash) % ABSENT_REASONS.length;
    return { status: 'ABSENT', reason: ABSENT_REASONS[reasonIdx] };
  } else if (val < 99) {
    return { status: 'LATE', reason: 'Traffic Delay' };
  } else {
    return { status: 'EXCUSED', reason: 'Prior Intimation / Sick Leave' };
  }
}

async function run() {
  console.log('--- STARTING FAST FULL-YEAR ATTENDANCE SEEDING FOR SHAFIULLA HIGH SCHOOL ---');

  const classSections = await prisma.classSection.findMany({
    where: { tenantId: TENANT_ID },
    include: {
      students: {
        where: { user: { isActive: true } },
        select: { id: true }
      }
    }
  });

  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true }
  });

  if (classSections.length === 0 || staff.length === 0) {
    console.error('No class sections or staff found for tenant.');
    return;
  }

  const defaultStaffId = staff[0].id;

  // 1. Load existing sessions into memory set
  const existingSessions = await prisma.attendanceSession.findMany({
    where: { tenantId: TENANT_ID },
    select: { classSectionId: true, date: true }
  });

  const existingSet = new Set(
    existingSessions.map(s => `${s.classSectionId}_${s.date.toISOString().split('T')[0]}`)
  );
  console.log(`Loaded ${existingSet.size} existing attendance sessions into cache.`);

  // 2. Generate working dates from Sept 5, 2026 to April 30, 2027
  const startDate = new Date('2026-09-05');
  const endDate = new Date('2027-04-30');

  const workingDates = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    if (!isHoliday(curr)) {
      workingDates.push(new Date(curr));
    }
    curr.setDate(curr.getDate() + 1);
  }

  console.log(`Working Days to process: ${workingDates.length} days.`);

  const sessionsToInsert = [];
  const attendancesToInsert = [];

  for (let dIdx = 0; dIdx < workingDates.length; dIdx++) {
    const dateObj = workingDates[dIdx];
    const dateStr = dateObj.toISOString().split('T')[0];

    for (let cIdx = 0; cIdx < classSections.length; cIdx++) {
      const cs = classSections[cIdx];
      if (cs.students.length === 0) continue;

      const key = `${cs.id}_${dateStr}`;
      if (existingSet.has(key)) continue; // already seeded

      const staffId = staff[(cIdx + dIdx) % staff.length].id || defaultStaffId;
      const sessionId = crypto.randomUUID();

      let presentCount = 0;
      let absentCount = 0;

      for (const student of cs.students) {
        const { status, reason } = getStudentAttendanceStatus(student.id, dateStr);
        if (status === 'PRESENT' || status === 'LATE') {
          presentCount++;
        } else {
          absentCount++;
        }

        attendancesToInsert.push({
          id: crypto.randomUUID(),
          attendanceSessionId: sessionId,
          studentId: student.id,
          status,
          reason,
          tenantId: TENANT_ID
        });
      }

      sessionsToInsert.push({
        id: sessionId,
        date: dateObj,
        classSectionId: cs.id,
        takenById: staffId,
        presentCount,
        absentCount,
        totalStudents: cs.students.length,
        tenantId: TENANT_ID
      });
    }
  }

  console.log(`Prepared ${sessionsToInsert.length} Sessions and ${attendancesToInsert.length} Attendance Records for insertion.`);

  // 3. Bulk insert Sessions
  if (sessionsToInsert.length > 0) {
    console.log('Inserting Attendance Sessions in bulk...');
    const SESSION_CHUNK = 1000;
    for (let i = 0; i < sessionsToInsert.length; i += SESSION_CHUNK) {
      const chunk = sessionsToInsert.slice(i, i + SESSION_CHUNK);
      await prisma.attendanceSession.createMany({
        data: chunk,
        skipDuplicates: true
      });
      console.log(`  Inserted sessions ${i + chunk.length}/${sessionsToInsert.length}`);
    }
  }

  // 4. Bulk insert Attendances
  if (attendancesToInsert.length > 0) {
    console.log('Inserting Attendance Records in bulk...');
    const ATTENDANCE_CHUNK = 5000;
    for (let i = 0; i < attendancesToInsert.length; i += ATTENDANCE_CHUNK) {
      const chunk = attendancesToInsert.slice(i, i + ATTENDANCE_CHUNK);
      await prisma.attendance.createMany({
        data: chunk,
        skipDuplicates: true
      });
      console.log(`  Inserted attendance records ${i + chunk.length}/${attendancesToInsert.length}`);
    }
  }

  console.log('==================================================');
  console.log('SUCCESSFULLY COMPLETED FULL-YEAR ATTENDANCE SEEDING!');
  console.log(`Sessions Added: ${sessionsToInsert.length}`);
  console.log(`Attendance Records Added: ${attendancesToInsert.length}`);
  console.log('==================================================');
}

run()
  .catch(e => console.error('Error in fast attendance seeder:', e))
  .finally(() => prisma.$disconnect());
