const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  
  for (const t of tenants) {
    console.log(`\n================ Tenant: ${t.name} (${t.id}) ================`);
    const staff = await prisma.staffProfile.findMany({
      where: { tenantId: t.id },
      include: { user: true }
    });
    console.log(`Total Staff Profiles: ${staff.length}`);
    for (const s of staff) {
      console.log(`- Staff ID: ${s.id}, User ID: ${s.userId}, Name: ${s.user?.name}, Email: ${s.user?.email}, Role: ${s.user?.role}, StaffRole: ${s.staffRole}, Designation: ${s.designation}, Category: ${s.staffCategory}, IsActive: ${s.user?.isActive}, Subjects: ${JSON.stringify(s.subjectsTaught)}`);
    }

    const teacherUsers = await prisma.user.findMany({
      where: { tenantId: t.id, role: { in: ['TEACHER', 'STAFF', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    console.log(`\nTeacher/Staff/Admin Users (${teacherUsers.length}):`, teacherUsers);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
