const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { subDomain: 'shafiulla-high-school' }
  });

  if (!tenant) {
    console.error("Tenant not found");
    return;
  }

  console.log(`Tenant ID: ${tenant.id}, Name: ${tenant.name}`);

  const classSections = await prisma.classSection.findMany({
    where: { tenantId: tenant.id },
    include: {
      class: true,
      section: true,
      students: { select: { id: true } },
      classSubjects: {
        include: { subject: true }
      }
    }
  });

  console.log(`Found ${classSections.length} class sections.`);

  for (const cs of classSections) {
    const className = cs.class.name;
    const sectionName = cs.section.name;
    const studentCount = cs.students.length;
    const subjects = cs.classSubjects.map(csSub => csSub.subject.name);
    console.log(`- Class: "${className}" | Section: "${sectionName}" | ClassSectionID: ${cs.id} | Students: ${studentCount} | Subjects: [${subjects.join(', ')}]`);
  }

  const allSubjects = await prisma.subject.findMany({
    where: { tenantId: tenant.id }
  });
  console.log(`All Subjects for Tenant (${allSubjects.length}):`, allSubjects.map(s => `${s.name} (${s.id})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
