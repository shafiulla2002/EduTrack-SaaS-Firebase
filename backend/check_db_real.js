const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, subDomain: true }
  });
  console.log('--- DB TENANTS ---');
  console.log(JSON.stringify(tenants, null, 2));

  for (const t of tenants) {
    const studentsCount = await prisma.studentProfile.count({ where: { tenantId: t.id } });
    const staffCount = await prisma.staffProfile.count({ where: { tenantId: t.id } });
    const userCount = await prisma.user.count({ where: { tenantId: t.id } });
    const attendanceCount = await prisma.attendance.count({ where: { tenantId: t.id } });
    const monthlyAttendanceCount = await prisma.monthlyAttendance.count({ where: { tenantId: t.id } });
    const invoiceCount = await prisma.invoice.count({ where: { tenantId: t.id } });
    const invoiceItemCount = await prisma.invoiceItem.count({ where: { tenantId: t.id } });
    const examMarkCount = await prisma.examMark.count({ where: { tenantId: t.id } });
    const classCount = await prisma.class.count({ where: { tenantId: t.id } });
    const sectionCount = await prisma.section.count({ where: { tenantId: t.id } });
    const classSectionCount = await prisma.classSection.count({ where: { tenantId: t.id } });
    const activityLogCount = await prisma.activityLog.count({ where: { tenantId: t.id } });

    console.log(`\n========================================`);
    console.log(`TENANT: ${t.name} (${t.id})`);
    console.log(`========================================`);
    console.log(`Students (StudentProfile): ${studentsCount}`);
    console.log(`Staff (StaffProfile): ${staffCount}`);
    console.log(`Users Total: ${userCount}`);
    console.log(`Classes: ${classCount}, Sections: ${sectionCount}, ClassSections: ${classSectionCount}`);
    console.log(`Daily Attendance Records: ${attendanceCount}`);
    console.log(`Monthly Attendance Summary Records: ${monthlyAttendanceCount}`);
    console.log(`Invoices: ${invoiceCount}, Invoice Items: ${invoiceItemCount}`);
    console.log(`Exam Marks: ${examMarkCount}`);
    console.log(`Activity Logs: ${activityLogCount}`);
  }

  // Also check total database table sizes if possible or general DB stats
  try {
    const tableSizes = await prisma.$queryRaw`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size,
        pg_total_relation_size(quote_ident(table_name)) as size_bytes
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC
      LIMIT 15;
    `;
    console.log('\n--- TOP 15 POSTGRESQL TABLES BY SIZE ---');
    console.log(JSON.stringify(tableSizes, null, 2));
  } catch (err) {
    console.error('Could not query table sizes:', err.message);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
