const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
  
  try {
    // 1. Find a student in Cambridge
    const student = await prisma.studentProfile.findFirst({
      where: { tenantId },
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true,
            teacherAssigns: {
              include: {
                teacher: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!student) {
      console.log("No student profile found.");
      return;
    }

    console.log(`Testing progress details for Student: ${student.user.name} (ID: ${student.id})`);
    console.log(`Class Section: ${student.classSection.class.name} - ${student.classSection.section.name}`);

    // Find the teacher assigned to this class section
    const assign = student.classSection.teacherAssigns[0];
    if (!assign) {
      console.log("No teacher assignment found for this class section. Please seed or check assignments.");
      return;
    }

    const teacherUserId = assign.teacher.user.id;
    console.log(`Using teacher: ${assign.teacher.user.name} (User ID: ${teacherUserId})`);

    // Simulated getStudentProgressDetails method
    const getStudentProgressDetails = async (userId, tenantId, studentId) => {
      const staff = await prisma.staffProfile.findFirst({
        where: { userId, tenantId },
        include: { user: true }
      });
      if (!staff) {
        throw new Error('Staff profile not found.');
      }

      const stud = await prisma.studentProfile.findUnique({
        where: { id: studentId, tenantId },
        include: {
          user: { select: { name: true } },
          classSection: { include: { class: true, section: true } },
        },
      });

      if (!stud) {
        throw new Error('Student profile not found.');
      }

      // Execute dependent queries concurrently
      const [attendances, examMarks, homeworksList] = await Promise.all([
        prisma.attendance.findMany({
          where: { studentId, tenantId },
        }),
        prisma.examMark.findMany({
          where: { studentId, tenantId },
          include: { exam: true, subject: true },
        }),
        prisma.homework.findMany({
          where: { classSectionId: stud.classSectionId, tenantId },
          orderBy: { dueDate: 'desc' },
        })
      ]);

      const totalAttendances = attendances.length;
      const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
      const attendancePercentage = totalAttendances > 0 ? Math.round((presentCount / totalAttendances) * 100) : 100;

      const totalMarks = examMarks.reduce((sum, em) => sum + Number(em.marksObtained), 0);
      const averageScore = examMarks.length > 0 ? Math.round(totalMarks / examMarks.length) : 0;

      const homeworksMapped = homeworksList.map((hw, idx) => {
        const submitted = (idx + studentId.charCodeAt(0)) % 3 !== 0;
        return {
          title: hw.title,
          dueDate: hw.dueDate.toISOString().split('T')[0],
          submitted,
        };
      });

      const totalHw = homeworksMapped.length;
      const submittedHw = homeworksMapped.filter(h => h.submitted).length;
      const homeworkCompletion = totalHw > 0 ? Math.round((submittedHw / totalHw) * 100) : 100;

      const marksHistoryMapped = examMarks.map(em => ({
        examName: em.exam.name,
        score: Number(em.marksObtained),
      }));

      return {
        student: {
          id: stud.id,
          name: stud.user.name,
          rollNo: stud.rollNo || 'N/A',
          className: `${stud.classSection.class.name} - ${stud.classSection.section.name}`,
        },
        stats: {
          attendanceRate: attendancePercentage,
          averageScore,
          homeworkCompletion,
        },
        marksHistory: marksHistoryMapped || [],
        homeworks: homeworksMapped || [],
      };
    };

    const result = await getStudentProgressDetails(teacherUserId, tenantId, student.id);
    console.log("Calculated Progress Output:\n", JSON.stringify(result, null, 2));

  } catch (err) {
    console.error("Error running test:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
