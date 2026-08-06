const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLeaveRequests(query, tenantId) {
  const whereClause = { tenantId };

  if (query) {
    const andConditions = [];

    if (query.status && query.status !== 'ALL') {
      andConditions.push({ status: query.status.toUpperCase() });
    }
    if (query.applicantType && query.applicantType !== 'ALL') {
      const appType = query.applicantType.toUpperCase();
      if (appType === 'STUDENT' || appType === 'PARENT') {
        andConditions.push({ applicantType: 'STUDENT' });
      } else if (appType === 'TEACHER' || appType === 'STAFF') {
        andConditions.push({ applicantType: 'STAFF' });
      }
    }
    if (query.leaveType && query.leaveType !== 'ALL') {
      andConditions.push({ leaveType: query.leaveType });
    }
    if (query.startDate) {
      andConditions.push({ startDate: { gte: new Date(query.startDate) } });
    }
    if (query.endDate) {
      andConditions.push({ endDate: { lte: new Date(query.endDate) } });
    }
    if (query.search) {
      const sTerm = query.search;
      andConditions.push({
        OR: [
          { teacher: { user: { name: { contains: sTerm, mode: 'insensitive' } } } },
          { teacher: { employeeId: { contains: sTerm, mode: 'insensitive' } } },
          { student: { user: { name: { contains: sTerm, mode: 'insensitive' } } } },
          { student: { rollNo: { contains: sTerm, mode: 'insensitive' } } },
        ]
      });
    }
    if (query.academicYearId && query.academicYearId !== 'ALL') {
      andConditions.push({
        OR: [
          { student: { classSection: { class: { academicYearId: query.academicYearId } } } },
          { teacher: { classSections: { some: { class: { academicYearId: query.academicYearId } } } } }
        ]
      });
    }

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }
  }

  return prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      teacher: { include: { user: true } },
      student: { include: { user: true } }
    }
  });
}

async function run() {
  try {
    // Get first tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log("No tenant found!");
      return;
    }
    const tenantId = tenant.id;
    console.log("Using Tenant ID:", tenantId);

    // Let's first print all leave requests to see what is there.
    const allLeaves = await prisma.leaveRequest.findMany({
      where: { tenantId },
      include: {
        teacher: { include: { user: true } },
        student: { include: { user: true } }
      }
    });
    console.log(`Total leaves in database: ${allLeaves.length}`);
    console.log("Leaves preview (first 5):");
    console.log(allLeaves.slice(0, 5).map(l => ({
      id: l.id,
      applicantType: l.applicantType,
      leaveType: l.leaveType,
      status: l.status,
      teacherName: l.teacher?.user?.name,
      studentName: l.student?.user?.name
    })));

    // Let's test the filters
    console.log("\n--- Testing STUDENT applicantType filter ---");
    const studentLeaves = await getLeaveRequests({ applicantType: 'STUDENT' }, tenantId);
    console.log(`Student leaves count: ${studentLeaves.length}`);
    console.log(studentLeaves.map(l => ({
      id: l.id,
      applicantType: l.applicantType,
      studentName: l.student?.user?.name
    })));

    console.log("\n--- Testing TEACHER applicantType filter ---");
    const teacherLeaves = await getLeaveRequests({ applicantType: 'TEACHER' }, tenantId);
    console.log(`Teacher/Staff leaves count: ${teacherLeaves.length}`);
    console.log(teacherLeaves.map(l => ({
      id: l.id,
      applicantType: l.applicantType,
      teacherName: l.teacher?.user?.name
    })));

    console.log("\n--- Testing STAFF applicantType filter (alternative input) ---");
    const staffLeaves = await getLeaveRequests({ applicantType: 'STAFF' }, tenantId);
    console.log(`Staff leaves count: ${staffLeaves.length}`);

    // If there are any leaves, let's test combine filters
    if (allLeaves.length > 0) {
      const sample = allLeaves[0];
      console.log(`\n--- Testing combined filter: applicantType=${sample.applicantType}, status=${sample.status} ---`);
      const combined = await getLeaveRequests({ applicantType: sample.applicantType, status: sample.status }, tenantId);
      console.log(`Filtered count: ${combined.length} (expected only ${sample.applicantType} with status ${sample.status})`);
      console.log(combined.map(l => ({
        id: l.id,
        applicantType: l.applicantType,
        status: l.status
      })));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
