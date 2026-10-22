const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: TENANT_ID },
    include: {
      user: true,
      teacherAssignments: {
        include: {
          classSection: { include: { class: true, section: true } },
          subject: true
        }
      },
      classSections: { include: { class: true, section: true } }
    }
  });

  console.log('=== STAFF PROFILES & THEIR ASSIGNED SUBJECTS & CLASSES ===');
  for (const s of staff) {
    console.log(`Staff: ${s.user.name} | StaffProfileId: ${s.id} | UserId: ${s.userId} | Role: ${s.user.role}`);
    console.log(`  Subjects Taught Array: [${s.subjectsTaught.join(', ')}]`);
    console.log(`  Advisor for ClassSections: [${s.classSections.map(cs => cs.class.name + '-' + cs.section.name).join(', ')}]`);
    if (s.teacherAssignments.length > 0) {
      s.teacherAssignments.forEach(ta => {
        console.log(`  -> Teaches ${ta.subject?.name} in ${ta.classSection.class.name}-${ta.classSection.section.name}`);
      });
    } else {
      console.log('  -> No explicit TeacherAssignments table records');
    }
  }

  const classSubjects = await prisma.classSubject.findMany({
    where: { class: { tenantId: TENANT_ID } },
    include: {
      class: true,
      subject: true
    }
  });
  console.log('\n=== CLASS SUBJECTS COUNT:', classSubjects.length);

  const subjects = await prisma.subject.findMany({
    where: { tenantId: TENANT_ID }
  });
  console.log('\n=== SUBJECTS FOR SHAFIULLA HIGH SCHOOL ===');
  subjects.forEach(sub => console.log(`- ${sub.name} (Code: ${sub.code}, Id: ${sub.id})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
