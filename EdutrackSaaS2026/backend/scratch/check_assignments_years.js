require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const teacher = await prisma.user.findFirst({
    where: { name: { contains: 'Baskar', mode: 'insensitive' } },
    include: {
      staffProfile: {
        include: {
          teacherAssignments: {
            include: {
              classSection: {
                include: {
                  class: {
                    include: {
                      academicYear: true
                    }
                  },
                  section: true
                }
              }
            }
          },
          periods: {
            include: {
              classSection: {
                include: {
                  class: {
                    include: {
                      academicYear: true
                    }
                  },
                  section: true
                }
              }
            }
          }
        }
      }
    }
  });

  console.log("Teacher Assignments & Academic Years:");
  for (const a of teacher.staffProfile.teacherAssignments) {
    console.log(`  Assignment ID: ${a.id}`);
    console.log(`    Class: ${a.classSection.class.name} (id: ${a.classSection.class.id})`);
    console.log(`    Section: ${a.classSection.section.name}`);
    console.log(`    Academic Year: ${a.classSection.class.academicYear.name} (active: ${a.classSection.class.academicYear.isActive})`);
  }

  console.log("Teacher Periods & Academic Years:");
  for (const p of teacher.staffProfile.periods) {
    console.log(`  Period ID: ${p.id}`);
    console.log(`    Class: ${p.classSection.class.name} (id: ${p.classSection.class.id})`);
    console.log(`    Section: ${p.classSection.section.name}`);
    console.log(`    Academic Year: ${p.classSection.class.academicYear.name} (active: ${p.classSection.class.academicYear.isActive})`);
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
