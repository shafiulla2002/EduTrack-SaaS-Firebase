const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function run() {
  const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1'; // Cambridge International School
  const phone = '9944208351';
  const email = 'vikas123@gmail.com';
  const name = 'Vikas';

  try {
    // 1. Cleanup existing Vikas records if any
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone }
        ]
      }
    });

    if (existingUser) {
      console.log(`Removing existing user: ${existingUser.id}`);
      await prisma.user.delete({
        where: { id: existingUser.id }
      });
    }

    // 2. Create User
    const passwordHash = await bcrypt.hash('password', 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'TEACHER',
        phone,
        tenantId
      }
    });
    console.log(`Created Teacher User: ${user.id} (${user.name})`);

    // 3. Create StaffProfile
    const staff = await prisma.staffProfile.create({
      data: {
        userId: user.id,
        employeeId: 'EMP8351',
        designation: 'Senior Faculty',
        status: 'Active',
        qualification: 'M.Sc Mathematics, B.Ed',
        subjectsTaught: ['Mathematics'],
        tenantId
      }
    });
    console.log(`Created Staff Profile: ${staff.id}`);

    // 4. Create TeacherAssignments
    const assignments = [
      {
        classSectionId: '14ad1cec-286d-4a88-816e-2ee2adc27728', // Class-10 - Section A
        subjectId: 'a75c4222-ecd5-499d-99e2-f2023d66b3f7' // Mathematics
      },
      {
        classSectionId: '0f5e1252-3dfc-40d9-81af-70a99f0ef488', // Class-10 - Section B
        subjectId: 'a75c4222-ecd5-499d-99e2-f2023d66b3f7' // Mathematics
      }
    ];

    for (const assign of assignments) {
      const a = await prisma.teacherAssignment.create({
        data: {
          teacherId: staff.id,
          classSectionId: assign.classSectionId,
          subjectId: assign.subjectId,
          tenantId
        }
      });
      console.log(`Created Teacher Assignment for subject: ${assign.subjectId} to classSection: ${assign.classSectionId}`);
    }

    console.log("Teacher Vikas seeded successfully!");

  } catch (err) {
    console.error('Error seeding teacher:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
