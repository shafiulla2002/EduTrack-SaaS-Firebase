const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock service logic from teacher-portal.service.ts
async function getStaffProfile(userId, tenantId) {
  const staff = await prisma.staffProfile.findFirst({
    where: { userId, tenantId, user: { isActive: true } },
    include: { user: true },
  });
  return staff;
}

async function getDashboardStats(userId, tenantId) {
  const staff = await getStaffProfile(userId, tenantId);
  if (!staff) return { error: "Staff not found" };

  const today = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDay = days[today.getDay()];
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [
    todayClasses,
    assignments,
    homeworkPendingCount,
    currentLeave,
    homeworkCreated,
    announcementsSent,
    upcomingEvents
  ] = await Promise.all([
    prisma.period.findMany({
      where: { tenantId, teacherId: staff.id, dayOfWeek: todayDay },
      include: {
        subject: { select: { name: true } },
        classSection: {
          include: {
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        periodTiming: { select: { startTime: true, endTime: true, periodNumber: true } },
      },
    }),
    prisma.teacherAssignment.findMany({
      where: { tenantId, teacherId: staff.id },
      include: { classSection: true },
    }),
    prisma.homework.count({
      where: { tenantId, teacherId: staff.id, dueDate: todayStart },
    }),
    prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        teacherId: staff.id,
        startDate: { lte: todayStart },
        endDate: { gte: todayStart },
      },
    }),
    prisma.homework.count({
      where: { tenantId, teacherId: staff.id },
    }),
    prisma.announcement.count({
      where: { tenantId, teacherId: staff.id },
    }),
    prisma.announcement.findMany({
      where: { tenantId, priority: 'High', expiryDate: { gte: todayStart } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
  ]);

  const classSectionIds = assignments.map(a => a.classSectionId);
  const uniqueClassSectionIds = Array.from(new Set(classSectionIds));
  const uniqueSubjectIds = Array.from(new Set(assignments.map(a => a.subjectId)));
  const totalSubjects = uniqueSubjectIds.length;

  const [
    totalStudents,
    todaySessions,
    todayExams,
    sessions,
    examsInClassSections
  ] = await Promise.all([
    prisma.studentProfile.count({
      where: { tenantId, classSectionId: { in: uniqueClassSectionIds } },
    }),
    prisma.attendanceSession.findMany({
      where: { tenantId, classSectionId: { in: uniqueClassSectionIds }, date: todayStart },
      select: { classSectionId: true },
    }),
    prisma.exam.findMany({
      where: { tenantId, classSectionId: { in: uniqueClassSectionIds }, date: todayStart },
      include: { classSection: { include: { class: true, section: true } } },
    }),
    prisma.attendanceSession.findMany({
      where: { tenantId, classSectionId: { in: uniqueClassSectionIds } },
      select: { presentCount: true, totalStudents: true },
    }),
    prisma.exam.findMany({
      where: { tenantId, classSectionId: { in: uniqueClassSectionIds } },
      include: { examMarks: true },
    })
  ]);

  const completedSessionIds = new Set(todaySessions.map(s => s.classSectionId));
  const pendingAttendanceCount = uniqueClassSectionIds.filter(id => !completedSessionIds.has(id)).length;
  const totalPresent = sessions.reduce((sum, s) => sum + s.presentCount, 0);
  const totalRoster = sessions.reduce((sum, s) => sum + s.totalStudents, 0);
  const attendancePercentage = totalRoster > 0 ? Math.round((totalPresent / totalRoster) * 1000) / 10 : 100;
  const pendingMarksCount = examsInClassSections.filter(e => e.examMarks.length === 0).length;

  return {
    todayClassesCount: todayClasses.length,
    assignmentsCount: assignments.length,
    homeworkPendingCount,
    totalStudents,
    pendingAttendanceCount,
    attendanceRate: attendancePercentage,
    pendingMarksCount,
    homeworkCreated,
    announcementsSent
  };
}

async function getAssignedClasses(userId, tenantId) {
  const staff = await getStaffProfile(userId, tenantId);
  if (!staff) return { error: "Staff not found" };

  const assignments = await prisma.teacherAssignment.findMany({
    where: { tenantId, teacherId: staff.id },
    include: {
      classSection: {
        include: {
          class: true,
          section: true,
          _count: { select: { students: true } },
        },
      },
      subject: true,
    },
  });

  return assignments.map(a => ({
    classSectionId: a.classSectionId,
    subjectId: a.subjectId,
    className: `${a.classSection.class.name} - ${a.classSection.section.name}`,
    subjectName: a.subject.name,
    strength: a.classSection._count.students,
  }));
}

async function run() {
  const userId = "d8695d49-38b8-4021-86b0-d2bedcbaa9a1";
  const tenantId = "ebc2dcb0-8985-43a7-bc83-c62b22f301d1";

  try {
    const stats = await getDashboardStats(userId, tenantId);
    console.log("=== Dashboard Stats ===");
    console.log(stats);

    const classes = await getAssignedClasses(userId, tenantId);
    console.log("=== Assigned Classes ===");
    console.log(classes);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
