const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("Connecting to database...");
    
    // Find a parent
    const parentLink = await prisma.parentStudent.findFirst({
      include: {
        parent: {
          include: {
            user: true
          }
        },
        student: {
          include: {
            user: true
          }
        }
      }
    });

    if (!parentLink) {
      console.log("No parents or parent-student links found in database.");
      return;
    }

    console.log(`Found parent student link:`);
    console.log(`Parent: ${parentLink.parent.user.name} (User ID: ${parentLink.parent.userId})`);
    console.log(`Student: ${parentLink.student.user.name} (Student ID: ${parentLink.studentId})`);

    // Let's query behavior cases for this student
    const cases = await prisma.behaviorCase.findMany({
      where: {
        studentId: parentLink.studentId,
        behaviorType: 'Complaint'
      },
      include: {
        teacher: {
          include: {
            user: true
          }
        }
      }
    });

    console.log(`Found ${cases.length} teacher complaints for student ${parentLink.student.user.name}`);
    cases.forEach(c => {
      console.log(`- Title/Category: ${c.category}`);
      console.log(`  Description: ${c.description}`);
      console.log(`  Teacher: ${c.teacher?.user?.name || 'Unknown'}`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Created: ${c.createdAt}`);
    });

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
