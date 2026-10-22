const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const tenant = await prisma.tenant.findFirst({
    where: { name: 'Oakridge International School' }
  });
  if (!tenant) {
    console.log("Tenant not found.");
    return;
  }
  console.log("Tenant ID:", tenant.id);
  console.log("Classes:", await prisma.class.count({ where: { tenantId: tenant.id } }));
  console.log("Sections:", await prisma.section.count({ where: { tenantId: tenant.id } }));
  console.log("ClassSections:", await prisma.classSection.count({ where: { tenantId: tenant.id } }));
  console.log("Subjects:", await prisma.subject.count({ where: { tenantId: tenant.id } }));
  console.log("Teachers (StaffProfiles):", await prisma.staffProfile.count({ where: { tenantId: tenant.id } }));
  console.log("TeacherAssignments:", await prisma.teacherAssignment.count({ where: { tenantId: tenant.id } }));
  console.log("Periods:", await prisma.period.count({ where: { tenantId: tenant.id } }));
  console.log("Students:", await prisma.studentProfile.count({ where: { tenantId: tenant.id } }));
}
check().finally(() => prisma.$disconnect());
