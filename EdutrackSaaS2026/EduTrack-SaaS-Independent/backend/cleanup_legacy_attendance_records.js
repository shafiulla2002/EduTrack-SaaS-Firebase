const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== LEGACY ATTENDANCE DATA CLEANUP SCRIPT (DISABLED BY DEFAULT) ===');

  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm-delete-legacy-data');

  const totalLegacyRecords = await prisma.attendance.count();
  const totalMonthlyRecords = await prisma.monthlyAttendance.count();

  console.log(`Current Legacy Individual Attendance Rows: ${totalLegacyRecords}`);
  console.log(`Current New MonthlyAttendance Rows: ${totalMonthlyRecords}`);

  if (!isConfirmed) {
    console.warn('\n[SAFETY GUARD ACTIVE]');
    console.warn('Legacy attendance records were NOT deleted.');
    console.warn('To execute cleanup after formal business approval and testing, run:');
    console.warn('  node cleanup_legacy_attendance_records.js --confirm-delete-legacy-data\n');
    return;
  }

  console.log('\n[CONFIRMED] Cleaning up legacy Attendance rows...');
  const result = await prisma.attendance.deleteMany();
  console.log(`Successfully deleted ${result.count} legacy Attendance records.`);
  console.log('Database storage optimization finalized!');
}

main()
  .catch(e => console.error('Cleanup error:', e))
  .finally(() => prisma.$disconnect());
