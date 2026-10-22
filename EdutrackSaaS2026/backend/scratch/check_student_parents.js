const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
    
    const students = await prisma.studentProfile.findMany({
      where: { tenantId },
      take: 5,
      include: {
        user: true,
        parentProfile: {
          include: {
            user: true
          }
        },
        classSection: {
          include: {
            class: true,
            section: true
          }
        }
      }
    });

    console.log("Students sample:");
    console.log(JSON.stringify(students.map(s => ({
      studentId: s.id,
      studentName: s.user.name,
      fatherName: s.fatherName,
      motherName: s.motherName,
      parentProfileId: s.parentProfileId,
      parentName: s.parentProfile?.user?.name,
      parentPhone: s.parentProfile?.user?.phone,
      class: s.classSection?.class?.name,
      section: s.classSection?.section?.name
    })), null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
