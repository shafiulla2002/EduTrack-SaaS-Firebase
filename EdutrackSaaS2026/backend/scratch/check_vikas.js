const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        name: {
          contains: 'Vikas',
          mode: 'insensitive'
        }
      }
    });

    console.log("=== Matching Tenants ===");
    for (const t of tenants) {
      console.log(`Tenant ID: ${t.id}, Name: ${t.name}`);

      const users = await prisma.user.findMany({
        where: {
          tenantId: t.id,
          role: { in: ['TEACHER', 'SCHOOL_ADMIN', 'STAFF'] }
        }
      });
      console.log(`  Staff/Teachers (${users.length}):`);
      for (const u of users) {
        console.log(`    - ID: ${u.id}, Name: ${u.name}, Phone: ${u.phone}, Role: ${u.role}, Email: ${u.email}`);
        
        // Find staff profile if any
        const staff = await prisma.staffProfile.findFirst({
          where: { userId: u.id }
        });
        if (staff) {
          console.log(`      StaffProfile ID: ${staff.id}, Designation: ${staff.designation}`);
          const assignments = await prisma.teacherAssignment.findMany({
            where: { teacherId: staff.id },
            include: {
              classSection: { include: { class: true, section: true } },
              subject: true
            }
          });
          console.log(`      Assignments (${assignments.length}):`);
          for (const a of assignments) {
            console.log(`        * ClassSection: ${a.classSection.class.name}-${a.classSection.section.name} (ID: ${a.classSectionId}), Subject: ${a.subject.name} (ID: ${a.subjectId})`);
          }

          const periods = await prisma.period.findMany({
            where: { teacherId: staff.id },
            include: {
              classSection: { include: { class: true, section: true } },
              subject: true,
              periodTiming: true
            }
          });
          console.log(`      Periods (${periods.length}):`);
          for (const p of periods) {
            console.log(`        * ${p.dayOfWeek} Period ${p.periodTiming.periodNumber} (${p.periodTiming.startTime}-${p.periodTiming.endTime}) for ${p.classSection.class.name}-${p.classSection.section.name}, Subject: ${p.subject.name}`);
          }
        }
      }

      const classSections = await prisma.classSection.findMany({
        where: { tenantId: t.id },
        include: { class: true, section: true }
      });
      console.log(`  Class Sections (${classSections.length}):`);
      for (const cs of classSections) {
        console.log(`    - ID: ${cs.id}, ${cs.class.name} - ${cs.section.name}`);
      }

      const subjects = await prisma.subject.findMany({
        where: { tenantId: t.id }
      });
      console.log(`  Subjects (${subjects.length}):`);
      for (const s of subjects) {
        console.log(`    - ID: ${s.id}, Name: ${s.name}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
