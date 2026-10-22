import { PrismaClient } from '@prisma/client';
import { AttendanceService } from './attendance/attendance.service';
import { TenantContext } from './tenants/tenant.context';

const prisma = new PrismaClient();
// Note: roleFilterHelper is null here because this script does not exercise teacher-scoped methods.
const service = new AttendanceService(prisma as any, null as any);

async function main() {
  const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';

  console.log(`Using tenant: ${tenantId}`);

  await TenantContext.run(tenantId, async () => {
    const data = await service.getAttendanceData('2026-07-01', '2026-07-31');
    console.log("--- SESSIONS FROM SERVICE ---");
    data.sessions.forEach(s => {
      console.log({
        id: s.id,
        className: s.className,
        section: s.section,
        attendanceDate: s.attendanceDate,
        totalStudents: s.totalStudents,
        presentCount: s.presentCount,
        absentCount: s.absentCount,
      });
    });
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
