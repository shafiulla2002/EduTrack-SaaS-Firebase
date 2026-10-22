const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simulated sendHomeworkToParents method from TeacherPortalService
async function sendHomeworkToParents(userId, tenantId, id) {
  const staff = await prisma.staffProfile.findFirst({
    where: { userId, tenantId },
    include: { user: true }
  });
  if (!staff) {
    throw new Error('Staff profile not found.');
  }

  const homework = await prisma.homework.findUnique({
    where: { id },
    include: {
      classSection: {
        include: {
          class: true,
          section: true,
        }
      },
      subject: true,
      tenant: true,
    }
  });

  if (!homework || homework.tenantId !== tenantId) {
    throw new Error('Homework assignment not found.');
  }

  // Fetch all students in this class section
  const students = await prisma.studentProfile.findMany({
    where: {
      classSectionId: homework.classSectionId,
      tenantId,
    },
    include: {
      user: true,
      parentProfile: {
        include: {
          user: true,
        }
      }
    }
  });

  const className = `${homework.classSection.class.name} - ${homework.classSection.section.name}`;
  const subjectName = homework.subject.name;
  const description = homework.description;
  const dueDateStr = homework.dueDate.toISOString().split('T')[0];
  const schoolName = homework.tenant.name;

  const messageTemplate = `📚 Homework Notification\n\n` +
    `Class: ${className}\n` +
    `Subject: ${subjectName}\n` +
    `Homework:\n${description}\n\n` +
    `Due Date: ${dueDateStr}\n\n` +
    `Regards,\n${schoolName}`;

  let successfullySent = 0;
  let failed = 0;

  for (const student of students) {
    let parentPhone = '';
    let parentName = '';

    if (student.parentProfile?.user?.phone) {
      parentPhone = student.parentProfile.user.phone;
      parentName = student.parentProfile.user.name;
    } else if (student.user?.phone) {
      parentPhone = student.user.phone;
      parentName = student.fatherName || 'Parent';
    }

    const normalizedPhone = parentPhone ? String(parentPhone).replace(/\D/g, '') : '';
    const isValid = normalizedPhone.length >= 10;

    if (isValid) {
      console.log(`[DISPATCH] [WHATSAPP] To Parent: ${parentName} (${normalizedPhone})`);
      console.log(`Message:\n${messageTemplate}`);
      console.log('--------------------------------------------------');
      successfullySent++;
    } else {
      console.log(`[DISPATCH] [WHATSAPP] Skipped student ${student.user.name} - Invalid or missing phone number: "${parentPhone}"`);
      failed++;
    }
  }

  return {
    success: true,
    totalStudents: students.length,
    successfullySent,
    failed
  };
}

async function run() {
  const userId = "d8695d49-38b8-4021-86b0-d2bedcbaa9a1"; // Vikas Kantala
  const tenantId = "ebc2dcb0-8985-43a7-bc83-c62b22f301d1"; // Cambridge International School

  try {
    // Find a homework record in Cambridge
    const homework = await prisma.homework.findFirst({
      where: { tenantId }
    });

    if (!homework) {
      console.log("No homework records found to test.");
      return;
    }

    console.log(`Testing bulk send for Homework ID: ${homework.id} ("${homework.title}")`);
    const result = await sendHomeworkToParents(userId, tenantId, homework.id);
    console.log("Bulk Send Result:", result);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
