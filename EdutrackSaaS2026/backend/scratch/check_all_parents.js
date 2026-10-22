const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
    
    const parentsCount = await prisma.parentProfile.count();
    console.log("Total ParentProfile records in db:", parentsCount);

    const linkedStudents = await prisma.studentProfile.count({
      where: {
        tenantId,
        parentProfileId: { not: null }
      }
    });
    console.log("Students with parentProfileId not null in Cambridge:", linkedStudents);

    // Let's see some User profiles with role = 'PARENT'
    const parentUsers = await prisma.user.findMany({
      where: {
        tenantId,
        role: 'PARENT'
      },
      take: 5,
      include: {
        parentProfile: {
          include: {
            students: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    console.log("Parent Users sample:");
    console.log(JSON.stringify(parentUsers.map(u => ({
      userId: u.id,
      name: u.name,
      phone: u.phone,
      parentProfileId: u.parentProfile?.id,
      students: u.parentProfile?.students.map(s => s.user.name)
    })), null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
