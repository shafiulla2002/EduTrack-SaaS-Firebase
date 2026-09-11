const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STATUS_CHAR_MAP = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  EXCUSED: 'E',
};

async function main() {
  console.log('=== STARTING HIGH-PERFORMANCE MONTHLY-WISE PAPA ATTENDANCE MIGRATION ===');

  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, subDomain: true } });
  console.log(`Found ${tenants.length} tenants to migrate.`);

  let totalMonthlyRecordsCreated = 0;

  for (const tenant of tenants) {
    console.log(`\n[Migrating Tenant] ${tenant.name} (${tenant.subDomain}) - ${tenant.id}`);

    const activeAcademicYear = await prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isActive: true },
    });

    const defaultAcademicYearId = activeAcademicYear ? activeAcademicYear.id : (
      await prisma.academicYear.findFirst({ where: { tenantId: tenant.id } })
    )?.id;

    if (!defaultAcademicYearId) {
      console.warn(`Skipping tenant ${tenant.name}: No academic year found.`);
      continue;
    }

    const classSections = await prisma.classSection.findMany({
      where: { tenantId: tenant.id },
      include: {
        class: true,
        students: {
          where: { user: { isActive: true } },
          select: { id: true },
        },
      },
    });

    console.log(`Processing ${classSections.length} Class Sections...`);

    for (let csIdx = 0; csIdx < classSections.length; csIdx++) {
      const cs = classSections[csIdx];
      const csAcademicYearId = cs.class.academicYearId || defaultAcademicYearId;
      const enrolledStudentIds = cs.students.map(s => s.id);
      if (enrolledStudentIds.length === 0) continue;

      // Fetch distinct months recorded for this classSection
      const rawMonths = await prisma.$queryRaw`
        SELECT DISTINCT to_char(date, 'YYYY-MM') AS month
        FROM "AttendanceSession"
        WHERE "tenantId" = ${tenant.id} AND "classSectionId" = ${cs.id}
        ORDER BY month ASC
      `;

      if (!rawMonths || rawMonths.length === 0) continue;

      console.log(`  -> ClassSection ${csIdx + 1}/${classSections.length} (Class: ${cs.class.name}): Found ${rawMonths.length} recorded months for ${enrolledStudentIds.length} students.`);

      for (const mObj of rawMonths) {
        const monthStr = mObj.month; // e.g. "2026-06"
        const [yearStr, monthNumStr] = monthStr.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthNumStr, 10);

        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

        // Fetch sessions for this month
        const monthSessions = await prisma.attendanceSession.findMany({
          where: {
            tenantId: tenant.id,
            classSectionId: cs.id,
            date: { gte: startDate, lte: endDate },
          },
          select: { id: true, date: true },
        });

        if (monthSessions.length === 0) continue;

        const sessionMap = new Map(); // sessionId -> day (1-31)
        const sessionIds = [];
        for (const s of monthSessions) {
          const day = new Date(s.date).getUTCDate();
          sessionMap.set(s.id, day);
          sessionIds.push(s.id);
        }

        // Fetch attendance records for these sessions
        const attendances = await prisma.attendance.findMany({
          where: {
            tenantId: tenant.id,
            attendanceSessionId: { in: sessionIds },
          },
          select: { attendanceSessionId: true, studentId: true, status: true },
        });

        // Build PAPA string per student for this month
        const studentPAPA = new Map();
        for (const sId of enrolledStudentIds) {
          studentPAPA.set(sId, new Array(31).fill('-'));
        }

        // 1. Mark implicit present for all sessions
        for (const s of monthSessions) {
          const dayIdx = sessionMap.get(s.id) - 1;
          for (const sId of enrolledStudentIds) {
            const arr = studentPAPA.get(sId);
            if (arr) arr[dayIdx] = 'P';
          }
        }

        // 2. Overwrite explicitly recorded statuses
        for (const att of attendances) {
          const day = sessionMap.get(att.attendanceSessionId);
          if (!day) continue;
          const dayIdx = day - 1;
          const arr = studentPAPA.get(att.studentId);
          if (arr) {
            arr[dayIdx] = STATUS_CHAR_MAP[att.status] || 'P';
          }
        }

        // 3. Prepare MonthlyAttendance rows
        const recordsToInsert = [];
        for (const [studentId, charArr] of studentPAPA.entries()) {
          recordsToInsert.push({
            tenantId: tenant.id,
            academicYearId: csAcademicYearId,
            studentId,
            classSectionId: cs.id,
            month: monthStr,
            attendance: charArr.join(''),
          });
        }

        if (recordsToInsert.length > 0) {
          await prisma.monthlyAttendance.createMany({
            data: recordsToInsert,
            skipDuplicates: true,
          });
          totalMonthlyRecordsCreated += recordsToInsert.length;
        }
      }
    }
  }

  const finalCount = await prisma.monthlyAttendance.count();

  console.log('\n==================================================');
  console.log('MIGRATION COMPLETED SUCCESSFULLY!');
  console.log(`Total MonthlyAttendance Records Created in DB: ${finalCount}`);
  console.log('==================================================');
}

main()
  .catch(e => {
    console.error('Migration failed with error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
