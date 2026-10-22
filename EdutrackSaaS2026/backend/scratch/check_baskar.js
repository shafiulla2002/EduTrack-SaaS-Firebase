require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const teacher = await prisma.user.findFirst({
    where: { name: { contains: 'Baskar', mode: 'insensitive' } },
    include: {
      staffProfile: {
        include: {
          classSections: {
            include: {
              class: true,
              section: true
            }
          },
          teacherAssignments: {
            include: {
              classSection: {
                include: {
                  class: true,
                  section: true
                }
              }
            }
          },
          periods: {
            include: {
              classSection: {
                include: {
                  class: true,
                  section: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!teacher) {
    console.log("Teacher Baskar not found");
    return;
  }

  console.log(`Teacher: ${teacher.name} (id: ${teacher.id})`);
  console.log(`Staff Profile: id=${teacher.staffProfile?.id}`);
  console.log("Advisor for Class Sections (classSections):");
  for (const cs of teacher.staffProfile?.classSections || []) {
    console.log(`  ClassSection: id=${cs.id}, Class: ${cs.class?.name}, Section: ${cs.section?.name}`);
  }
  console.log("TeacherAssignments:");
  for (const a of teacher.staffProfile?.teacherAssignments || []) {
    console.log(`  Assignment id: ${a.id}, ClassSectionId: ${a.classSectionId}, Class: ${a.classSection?.class.name}, Section: ${a.classSection?.section.name}, TenantId: ${a.tenantId}`);
  }
  console.log("Periods:");
  for (const p of teacher.staffProfile?.periods || []) {
    console.log(`  Period id: ${p.id}, ClassSectionId: ${p.classSectionId}, Class: ${p.classSection?.class.name}, Section: ${p.classSection?.section.name}, TenantId: ${p.tenantId}`);
  }

  // Let's test the database query that runs for getSectionsForAttendance
  const staffId = teacher.staffProfile?.id;
  const classVal = 'Class-2';
  const tenantId = teacher.tenantId;

  console.log(`\nTesting database query for classVal = '${classVal}', tenantId = '${tenantId}':`);
  const [assignments, periods] = await Promise.all([
    prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        teacherId: staffId,
        classSection: { class: { name: { equals: classVal, mode: 'insensitive' } } },
      },
      include: { classSection: { include: { section: true } } },
    }),
    prisma.period.findMany({
      where: {
        tenantId,
        teacherId: staffId,
        classSection: { class: { name: { equals: classVal, mode: 'insensitive' } } },
      },
      include: { classSection: { include: { section: true } } },
    }),
  ]);

  console.log(`Found assignments in query: ${assignments.length}`);
  for (const a of assignments) {
    console.log(`  a.classSection.section: ${a.classSection?.section?.name}`);
  }
  console.log(`Found periods in query: ${periods.length}`);
  for (const p of periods) {
    console.log(`  p.classSection.section: ${p.classSection?.section?.name}`);
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
