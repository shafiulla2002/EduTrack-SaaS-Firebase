const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const student = await prisma.studentProfile.findFirst({
    where: {
      user: {
        name: { contains: 'Amarnath' }
      }
    },
    include: {
      user: true,
      classSection: {
        include: {
          class: true,
          section: true
        }
      }
    }
  });

  if (!student) {
    console.log("Amarnath not found");
    return;
  }

  console.log("Simulating update student transaction with email change...");
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Prepare user updates
      const userUpdates = {
        name: "Amarnath Verma",
        email: "amarnathv@example.com", // changed from amarnath.v@example.com
        phone: "1155997757" // original
      };
      
      console.log("Updating user table...");
      await tx.user.update({
        where: { id: student.userId },
        data: userUpdates
      });

      // 2. Prepare profile updates
      const profileUpdates = {
        fatherName: "Rajesh Verma",
        motherName: "Anita Verma",
        aadharNo: "888888888888", // From user screenshot
        rollNo: "2"
      };

      console.log("Updating studentProfile table...");
      await tx.studentProfile.update({
        where: { id: student.id },
        data: profileUpdates
      });

      console.log("Update transaction completed successfully!");
    });
  } catch (error) {
    console.error("Transaction failed with error:", error);
  }
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
