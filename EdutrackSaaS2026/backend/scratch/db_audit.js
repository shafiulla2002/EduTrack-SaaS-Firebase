const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DATABASE COUNTS & PERF AUDIT ===');
  const counts = {
    users: await prisma.user.count(),
    parents: await prisma.parentProfile.count(),
    parentLinks: await prisma.studentParentLink.count(),
    students: await prisma.studentProfile.count(),
    teachers: await prisma.staffProfile.count(),
    classes: await prisma.class.count(),
    classSections: await prisma.classSection.count(),
    homework: await prisma.homework.count(),
    attendance: await prisma.attendanceRecord.count(),
    invoices: await prisma.invoice.count(),
  };
  console.log('Record counts:\n', JSON.stringify(counts, null, 2));

  // Check sample Parent Profile & linked children
  const sampleParent = await prisma.parentProfile.findFirst({
    include: {
      user: true,
      students: { include: { student: { include: { user: true, classSection: { include: { class: true, section: true } } } } } },
    }
  });

  if (sampleParent) {
    console.log('\nSample Parent User:', sampleParent.user.name, 'Email:', sampleParent.user.email, 'Tenant:', sampleParent.user.tenantId);
    console.log('Linked children count:', sampleParent.students.length);
    for (const link of sampleParent.students) {
      console.log(' - Child:', link.student?.user?.name, 'ID:', link.studentId, 'ClassSection:', link.student?.classSection?.class?.name, link.student?.classSection?.section?.name);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
