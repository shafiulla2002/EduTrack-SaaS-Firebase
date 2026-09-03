import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BillingService } from '../billing/billing.service';
import { StorageService } from '../common/storage.service';
import { ExamConfigService } from '../exam-config/exam-config.service';
import { Role, PaymentStatus } from '@prisma/client';
import { parseAttendanceDate } from '../attendance/date.utils';

export interface PaymentGatewayResult {
  success: boolean;
  transactionId: string;
  gatewayMessage: string;
}

@Injectable()
export class ParentPortalPaymentProcessor {
  async processPayment(amount: number, method: string, invoiceId: string): Promise<PaymentGatewayResult> {
    // This is modularly separated and can be replaced with Stripe/Razorpay integrations later
    return {
      success: true,
      transactionId: `TXN-${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
      gatewayMessage: `Mock payment of ₹${amount} completed successfully via ${method} for invoice ${invoiceId}`,
    };
  }
}

@Injectable()
export class ParentPortalService {
  private paymentProcessor = new ParentPortalPaymentProcessor();

  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
    private storageService: StorageService,
    private examConfigService: ExamConfigService,
  ) {}

  private async verifyOwnership(userId: string, studentId: string): Promise<any> {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId },
    });
    if (!parent) {
      throw new NotFoundException('Parent profile not found');
    }

    const link = await this.prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId: parent.id,
          studentId: studentId,
        },
      },
      include: {
        student: {
          include: {
            user: true,
            classSection: {
              include: {
                class: true,
                section: true,
              },
            },
          },
        },
      },
    });

    if (!link) {
      throw new ForbiddenException('You do not have permission to access records for this student');
    }

    return link.student;
  }

  private async logAction(userId: string, tenantId: string, action: string, entityName: string, entityId?: string, details?: any) {
    await this.prisma.activityLog.create({
      data: {
        userId,
        tenantId,
        action,
        entityName,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
      },
    }).catch((err) => console.error('Failed to create audit activity log:', err));
  }

  private async createNotification(recipientId: string, title: string, message: string, type = 'IN_APP') {
    await this.prisma.notification.create({
      data: {
        recipientId,
        title,
        message,
        type,
      },
    }).catch((err) => console.error('Failed to log parent notification:', err));
  }

  async getParentProfile(userId: string) {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!parent) {
      throw new NotFoundException('Parent profile not found');
    }
    return parent;
  }

  async getChildren(userId: string) {
    const parent = await this.getParentProfile(userId);
    const links = await this.prisma.parentStudent.findMany({
      where: { parentId: parent.id },
      include: {
        student: {
          include: {
            user: true,
            classSection: {
              include: {
                class: true,
                section: true,
              },
            },
          },
        },
      },
    });

    return links.map(l => ({
      id: l.student.id,
      name: l.student.user.name,
      rollNo: l.student.rollNo || 'N/A',
      avatarUrl: l.student.user.avatarUrl || l.student.profilePhotoUrl,
      class: l.student.classSection?.class.name || 'N/A',
      section: l.student.classSection?.section.name || 'N/A',
      classSectionId: l.student.classSectionId,
      relationship: l.relationship,
      isPrimary: l.isPrimary,
      fatherName: l.student.fatherName || 'N/A',
      motherName: l.student.motherName || 'N/A',
    }));
  }

  async getDashboardStats(userId: string, tenantId: string) {
    const children = await this.getChildren(userId);
    if (children.length === 0) {
      return {
        totalChildren: 0,
        todayAttendance: 'N/A',
        homeworkPending: 0,
        pendingFees: 0,
        upcomingExams: 0,
        announcements: [],
        notifications: [],
      };
    }

    const studentIds = children.map(c => c.id);
    const classSectionIds = children.map(c => c.classSectionId).filter(Boolean) as string[];

    // 1. Total Outstanding Fees directly from BillingService single source of truth
    let pendingFees = 0;
    for (const childId of studentIds) {
      try {
        const billingInfo = await this.billingService.getStudentById(childId);
        pendingFees += Number(billingInfo.totalPendingBalance || 0);
      } catch (err) {
        console.error(`Failed to fetch billing info for student ${childId}:`, err);
      }
    }

    // 2. Pending Homework count
    const homeworkCount = await this.prisma.homework.count({
      where: {
        classSectionId: { in: classSectionIds },
        tenantId,
        dueDate: { gte: new Date() },
      },
    });

    // 3. Upcoming Exams (next 14 days)
    const upcomingExams = await this.prisma.examSchedule.count({
      where: {
        classSectionId: { in: classSectionIds },
        tenantId,
        examDate: { gte: new Date() },
      },
    });

    // 4. Combined announcements
    const rawAnnouncements = await this.prisma.announcement.findMany({
      where: {
        tenantId,
        OR: [
          { audienceType: 'INSTITUTION' },
          { classSectionId: { in: classSectionIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const announcements = rawAnnouncements.map(ann => ({
      ...ann,
      content: this.sanitizeAnnouncementContent(ann.content),
    }));

    // 5. Combined notifications
    const parent = await this.getParentProfile(userId);
    const notificationRecipients = [parent.userId];

    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientId: { in: notificationRecipients },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 6. Student-specific Today's Attendance Summary
    const todayUTC = parseAttendanceDate(null);
    let markedChildrenCount = 0;
    let presentChildrenCount = 0;

    for (const child of children) {
      if (!child.classSectionId) continue;

      const session = await this.prisma.attendanceSession.findFirst({
        where: {
          classSectionId: child.classSectionId,
          date: todayUTC,
          tenantId,
        },
        include: {
          attendances: {
            where: { studentId: child.id },
          },
        },
      });

      if (session) {
        markedChildrenCount++;
        const record = session.attendances[0];
        const status = record ? record.status : 'PRESENT';
        if (status === 'PRESENT' || status === 'LATE') {
          presentChildrenCount++;
        }
      }
    }

    let todayAttendanceStr = 'Attendance Not Taken Yet';
    if (markedChildrenCount > 0) {
      if (children.length === 1) {
        todayAttendanceStr = `${presentChildrenCount}/${children.length} Present`;
      } else {
        todayAttendanceStr = `${presentChildrenCount}/${children.length} Children Present`;
      }
    }

    return {
      totalChildren: children.length,
      todayAttendance: todayAttendanceStr,
      homeworkPending: homeworkCount,
      pendingFees,
      upcomingExams,
      announcements,
      notifications,
    };
  }

  async getChildDashboard(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);

    // Get attendance metrics
    const attendances = await this.prisma.attendance.findMany({
      where: { studentId },
      select: { status: true },
    });
    const total = attendances.length;
    const present = attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const hasAttendanceData = total > 0;
    const attendancePercentage = hasAttendanceData ? Math.round((present / total) * 100) : null;

    // Check today's submission status for this child
    const todayUTC = parseAttendanceDate(null);
    let todayAttendanceSubmitted = false;
    let todayAttendanceStatus = 'NOT_TAKEN';

    if (student.classSectionId) {
      const todaySession = await this.prisma.attendanceSession.findFirst({
        where: {
          classSectionId: student.classSectionId,
          date: todayUTC,
          tenantId: student.tenantId,
        },
        include: {
          attendances: {
            where: { studentId },
          },
        },
      });

      if (todaySession) {
        todayAttendanceSubmitted = true;
        const record = todaySession.attendances[0];
        todayAttendanceStatus = record ? record.status : 'PRESENT';
      }
    }

    // Get pending homework
    let pendingHomework = 0;
    if (student.classSectionId) {
      pendingHomework = await this.prisma.homework.count({
        where: {
          classSectionId: student.classSectionId,
          dueDate: { gte: new Date() },
        },
      });
    }

    // Get fee stats
    const billingInfo = await this.billingService.getStudentById(studentId);
    const pendingFees = billingInfo.totalPendingBalance;

    // Get upcoming exams
    let upcomingExams = [];
    if (student.classSectionId) {
      upcomingExams = await this.prisma.examSchedule.findMany({
        where: {
          classSectionId: student.classSectionId,
          examDate: { gte: new Date() },
        },
        include: { subject: true },
        orderBy: { examDate: 'asc' },
        take: 3,
      });
    }

    // Get recent results
    const recentMarks = await this.prisma.examMark.findMany({
      where: { studentId },
      include: { exam: true, subject: true },
      orderBy: { exam: { date: 'desc' } },
      take: 5,
    });

    // Fetch all parent links for this student to get all details
    const parentLinks = await this.prisma.parentStudent.findMany({
      where: { studentId },
      include: {
        parent: {
          include: {
            user: true,
          },
        },
      },
    });

    const currentParentLink = parentLinks.find(pl => pl.parent.userId === userId);
    const relationship = currentParentLink?.relationship || 'Guardian';

    const guardianLink = parentLinks.find(pl => pl.relationship.toLowerCase() === 'guardian');
    const guardianName = guardianLink?.parent?.user?.name || null;
    const guardianPhone = student.guardianPhone || guardianLink?.parent?.user?.phone || null;

    const primaryLink = parentLinks.find(pl => pl.isPrimary) || currentParentLink || parentLinks[0];
    const primaryContactRole = primaryLink?.relationship || 'Guardian';
    const primaryContactPhone = primaryLink?.parent?.user?.phone || null;

    let classAdvisor = null;
    let subjectTeachers = [];

    if (student.classSectionId) {
      const classSection = await this.prisma.classSection.findUnique({
        where: { id: student.classSectionId },
        include: {
          teacher: {
            include: {
              user: true,
            },
          },
        },
      });

      if (classSection?.teacher) {
        classAdvisor = {
          name: classSection.teacher.user.name,
          employeeId: classSection.teacher.employeeId || 'N/A',
          email: classSection.teacher.user.email || '',
          phone: classSection.teacher.user.phone || classSection.teacher.whatsappNumber || '',
          avatarUrl: classSection.teacher.user.avatarUrl || null,
          designation: classSection.teacher.designation || 'Class Advisor',
          department: classSection.teacher.designation ? (classSection.teacher.designation.includes('Department') ? classSection.teacher.designation : `${classSection.teacher.designation} Department`) : 'Academics',
        };
      }

      const assignments = await this.prisma.teacherAssignment.findMany({
        where: { classSectionId: student.classSectionId },
        include: {
          subject: true,
          teacher: {
            include: {
              user: true,
            },
          },
        },
      });

      const teacherMap = new Map<string, {
        name: string;
        employeeId: string;
        email: string;
        phone: string;
        avatarUrl: string | null;
        designation: string;
        department: string;
        subjects: string[];
      }>();

      for (const a of assignments) {
        const tId = a.teacher.id;
        const subjectName = a.subject.name;

        if (teacherMap.has(tId)) {
          const tData = teacherMap.get(tId)!;
          if (!tData.subjects.includes(subjectName)) {
            tData.subjects.push(subjectName);
          }
        } else {
          teacherMap.set(tId, {
            name: a.teacher.user.name,
            employeeId: a.teacher.employeeId || 'N/A',
            email: a.teacher.user.email || '',
            phone: a.teacher.user.phone || a.teacher.whatsappNumber || '',
            avatarUrl: a.teacher.user.avatarUrl || null,
            designation: a.teacher.designation || 'Subject Teacher',
            department: a.teacher.designation ? (a.teacher.designation.includes('Department') ? a.teacher.designation : `${a.teacher.designation} Department`) : 'Academics',
            subjects: [subjectName],
          });
        }
      }

      subjectTeachers = Array.from(teacherMap.values());
    }

    const cleanDisplayPhone = (phone?: string | null): string => {
      if (!phone || phone === 'N/A') return 'N/A';
      if (phone.includes('-')) {
        const parts = phone.split('-');
        const lastPart = parts[parts.length - 1];
        if (/^\d{7,15}$/.test(lastPart)) {
          return lastPart;
        }
      }
      return phone;
    };

    return {
      student: {
        id: student.id,
        name: student.user.name,
        rollNo: student.rollNo || 'N/A',
        class: student.classSection?.class.name || 'N/A',
        section: student.classSection?.section.name || 'N/A',
        avatarUrl: student.user.avatarUrl || student.profilePhotoUrl,
        classSectionId: student.classSectionId,
        fatherName: student.fatherName || 'N/A',
        motherName: student.motherName || 'N/A',
        fatherPhone: cleanDisplayPhone(student.fatherPhone),
        motherPhone: cleanDisplayPhone(student.motherPhone),
        guardianName: guardianName || 'N/A',
        guardianPhone: cleanDisplayPhone(guardianPhone),
        emergencyPhone: cleanDisplayPhone(currentParentLink?.parent?.emergencyContact),
        primaryContactPhone: cleanDisplayPhone(primaryContactPhone),
        primaryContactRole: primaryContactRole,
      },
      metrics: {
        attendancePercentage,
        hasAttendanceData,
        todayAttendanceSubmitted,
        todayAttendanceStatus,
        pendingHomework,
        pendingFees,
        upcomingExamsCount: upcomingExams.length,
      },
      upcomingExams,
      recentMarks,
      classAdvisor,
      subjectTeachers,
    };
  }

  async getAttendance(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);

    const attendances = await this.prisma.attendance.findMany({
      where: { studentId },
      include: {
        attendanceSession: {
          select: { date: true, takenBy: { include: { user: true } } },
        },
      },
      orderBy: { attendanceSession: { date: 'desc' } },
    });

    const total = attendances.length;
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const late = attendances.filter(a => a.status === 'LATE').length;
    const absent = attendances.filter(a => a.status === 'ABSENT').length;
    const excused = attendances.filter(a => a.status === 'EXCUSED').length;

    const hasAttendanceData = total > 0;
    const rate = hasAttendanceData ? Math.round(((present + late) / total) * 100) : null;

    // Check today's submission state
    const todayUTC = parseAttendanceDate(null);
    let todayAttendanceSubmitted = false;
    let todayAttendanceStatus = 'NOT_TAKEN';

    if (student.classSectionId) {
      const todaySession = await this.prisma.attendanceSession.findFirst({
        where: {
          classSectionId: student.classSectionId,
          date: todayUTC,
          tenantId: student.tenantId,
        },
        include: {
          attendances: {
            where: { studentId },
          },
        },
      });

      if (todaySession) {
        todayAttendanceSubmitted = true;
        const record = todaySession.attendances[0];
        todayAttendanceStatus = record ? record.status : 'PRESENT';
      }
    }

    return {
      summary: {
        total,
        present,
        absent,
        late,
        excused,
        attendanceRate: rate,
        hasAttendanceData,
        todayAttendanceSubmitted,
        todayAttendanceStatus,
      },
      records: attendances.map(a => ({
        id: a.id,
        date: a.attendanceSession.date,
        status: a.status,
        reason: a.reason,
        markedBy: a.attendanceSession.takenBy?.user?.name || 'Teacher',
      })),
    };
  }

  async getHomework(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);
    if (!student.classSectionId) return [];

    const homeworkList = await this.prisma.homework.findMany({
      where: {
        classSectionId: student.classSectionId,
        status: 'Published',
      },
      include: {
        subject: true,
        teacher: { include: { user: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Query actual submissions stored in ActivityLog table to maintain persistence
    const submissionsLogs = await this.prisma.activityLog.findMany({
      where: {
        tenantId: student.tenantId,
        action: 'SUBMIT_ASSIGNMENT',
        entityName: 'Homework',
      },
      orderBy: { createdAt: 'desc' },
    });

    return homeworkList.map(h => {
      const logMatch = submissionsLogs.find(log => {
        try {
          const detailObj = JSON.parse(log.details || '{}');
          return detailObj.studentId === studentId && log.entityId === h.id;
        } catch {
          return false;
        }
      });

      return {
        id: h.id,
        title: h.title,
        description: h.description,
        dueDate: h.dueDate,
        maxMarks: Number(h.maxMarks),
        assignmentType: h.assignmentType,
        attachments: logMatch ? [JSON.parse(logMatch.details || '{}').fileUrl] : h.attachments,
        subject: h.subject.name,
        teacher: h.teacher.user?.name || 'Teacher',
        submitted: !!logMatch,
        submissionStatus: logMatch ? 'Pending Approval' : 'Pending',
      };
    });
  }

  async submitAssignment(userId: string, studentId: string, homeworkId: string, base64File: string, fileName: string) {
    const student = await this.verifyOwnership(userId, studentId);

    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
    });
    if (!homework) {
      throw new NotFoundException('Homework assignment not found');
    }

    // Upload attachment using S3 Centralized StorageService
    let fileUrl = 'mock_attachment.pdf';
    if (base64File) {
      fileUrl = await this.storageService.uploadImage(base64File, student.tenantId, studentId, 'homework-submission');
    }

    // Save submission inside ActivityLog audit table for query retrieval
    await this.logAction(userId, student.tenantId, 'SUBMIT_ASSIGNMENT', 'Homework', homeworkId, {
      studentId,
      fileName,
      fileUrl,
    });

    // Trigger Notification confirmations
    const parent = await this.getParentProfile(userId);
    await this.createNotification(
      parent.userId,
      `Work Submitted: ${homework.title}`,
      `Successfully uploaded ${fileName} for child ${student.user.name}.`,
    );

    return {
      success: true,
      message: 'Homework assignment submitted successfully.',
      fileUrl,
    };
  }

  async getExams(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);
    if (!student.classSectionId) {
      return { schedules: [], exams: [], marks: [] };
    }

    const [schedules, rawMarks] = await Promise.all([
      this.prisma.examSchedule.findMany({
        where: { classSectionId: student.classSectionId },
        include: { subject: true },
        orderBy: { examDate: 'asc' },
      }),
      this.prisma.examMark.findMany({
        where: { studentId },
        include: { exam: true, subject: true },
        orderBy: { exam: { date: 'desc' } },
      }),
    ]);

    // ── Group this student's marks by exam ───────────────────────────────
    const byExam = new Map<string, { exam: any; subjects: any[] }>();
    for (const m of rawMarks) {
      const key = m.exam.id;
      if (!byExam.has(key)) byExam.set(key, { exam: m.exam, subjects: [] });
      byExam.get(key)!.subjects.push(m);
    }

    // ── Build exam-wise report cards ─────────────────────────────────────
    const examCards = await Promise.all(
      Array.from(byExam.values()).map(async ({ exam, subjects }) => {
        const examName: string = exam.name;
        const classSectionId: string = exam.classSectionId;

        // Resolve pass criteria from ExamConfigService
        const cfg = await this.examConfigService.resolveConfig(examName, exam.tenantId);
        
        // Eagerly load ExamSubjects for all components in this exam
        const examSubjects = await this.examConfigService.getExamSubjects(exam.id);
        const subjectConfigMap = new Map<string, any>(examSubjects.map(es => [`${es.subjectId}_${es.subjectType}`, es]));

        // Fetch ALL marks in this exam+section to compute rank
        const allMarks = await this.prisma.examMark.findMany({
          where: { examId: exam.id, tenantId: exam.tenantId },
          select: { studentId: true, marksObtained: true },
        });

        // Aggregate total per student
        const studentTotals = new Map<string, number>();
        for (const am of allMarks) {
          const prev = studentTotals.get(am.studentId) ?? 0;
          studentTotals.set(am.studentId, prev + Number(am.marksObtained));
        }

        // Sort descending for rank (dense rank: same marks = same rank)
        const sortedTotals = Array.from(studentTotals.values()).sort((a, b) => b - a);
        const classSize = studentTotals.size;
        const myTotal = studentTotals.get(studentId) ?? 0;
        let rank = 1;
        for (const t of sortedTotals) {
          if (t > myTotal) rank++;
          else break;
        }

        // Build subject rows
        const subjectRows = await Promise.all(subjects.map(async (m) => {
          let es = subjectConfigMap.get(`${m.subjectId}_${m.subjectType}`);
          if (!es) {
             es = await this.examConfigService.getOrInitializeExamSubject(exam.id, m.subjectId, m.subjectType, exam.tenantId);
             subjectConfigMap.set(`${m.subjectId}_${m.subjectType}`, es);
          }
          const maxMarksPerSubject = es.maxMarks;
          const passingPct = Number(es.passingPercentage);

          const marks = Number(m.marksObtained);
          const pct = maxMarksPerSubject > 0 ? (marks / maxMarksPerSubject) * 100 : 0;
          const gradeInfo = this.examConfigService.calculateGrade(pct, cfg.gradeRanges);
          const pass = pct >= passingPct;
          return {
            id: m.id,
            subject: m.subject.name,
            subjectType: m.subjectType,
            marksObtained: marks,
            maxMarks: maxMarksPerSubject,
            percentage: Math.round(pct * 10) / 10,
            grade: gradeInfo.grade,
            gpa: gradeInfo.gpa,
            result: pass ? 'PASS' : 'FAIL',
            remarks: m.remarks || 'Good performance',
          };
        }));

        const totalObtained = subjectRows.reduce((s, r) => s + r.marksObtained, 0);
        const totalMax = subjectRows.reduce((s, r) => s + r.maxMarks, 0);
        const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
        const overallGradeInfo = this.examConfigService.calculateGrade(overallPct, cfg.gradeRanges);
        // Any single subject FAIL → overall FAIL
        const overallResult = subjectRows.some(r => r.result === 'FAIL') ? 'FAIL' : 'PASS';

        return {
          examName,
          examDate: exam.date,
          rank,
          classSize,
          totalObtained,
          totalMax,
          percentage: Math.round(overallPct * 10) / 10,
          overallGrade: overallGradeInfo.grade,
          overallGpa: overallGradeInfo.gpa,
          overallResult,
          passingPercentage: cfg.passingPercentage, // Overall passing criteria for display purposes
          configSource: cfg.source,
          subjects: subjectRows,
        };
      }),
    );

    // Sort exam cards newest first
    examCards.sort((a, b) =>
      new Date(b.examDate).getTime() - new Date(a.examDate).getTime(),
    );

    // Legacy marks array (for backward compatibility)
    const legacyMarks = rawMarks.map(m => {
      const marksVal = Number(m.marksObtained);
      const { grade } = this.examConfigService.calculateGrade(marksVal, []);
      let legacyGrade = 'F';
      if (marksVal >= 90) legacyGrade = 'A+';
      else if (marksVal >= 80) legacyGrade = 'A';
      else if (marksVal >= 70) legacyGrade = 'B';
      else if (marksVal >= 60) legacyGrade = 'C';
      else if (marksVal >= 50) legacyGrade = 'D';

      return {
        id: m.id,
        examName: m.exam.name,
        subject: m.subject.name,
        marksObtained: marksVal,
        remarks: m.remarks || 'Good performance',
        grade: legacyGrade,
      };
    });

    return {
      schedules: schedules.map(s => ({
        id: s.id,
        examName: s.examName,
        subject: s.subject.name,
        examDate: s.examDate,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
        examHall: s.examHall || 'Main Hall',
        instructions: s.instructions,
      })),
      exams: examCards,   // ← new grouped structure
      marks: legacyMarks, // ← backward compat
    };
  }

  async getFees(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);

    // Single source of truth: fetch live billing and ledger balance directly from BillingService
    const billingSummary = await this.billingService.getStudentById(studentId);

    const dbInvoices = await this.prisma.invoice.findMany({
      where: { studentId: student.id },
      include: {
        invoiceItems: true,
        opportunity: {
          include: {
            academicYear: true,
            class: true,
            section: true,
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const tenantDetails = await this.prisma.tenant.findUnique({
      where: { id: student.tenantId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        subtitle: true,
        bankName: true,
        bankBranch: true,
        bankIFSC: true,
        bankAccountNo: true,
        googlePayId: true,
        phonePeId: true,
        upiQrId: true,
      },
    });

    const paymentLogs = await this.prisma.activityLog.findMany({
      where: {
        tenantId: student.tenantId,
        action: 'FEE_PAYMENT',
        entityName: 'Invoice',
      },
    });

    const mappedInvoices = dbInvoices.map(inv => {
      const log = paymentLogs.find(l => l.entityId === inv.id);
      let transactionId = `TXN-${inv.id.substring(0, 8).toUpperCase()}`;
      if (log && log.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed.transactionId) transactionId = parsed.transactionId;
        } catch {}
      }

      return {
        id: inv.id,
        opportunityId: inv.opportunityId,
        invoiceNo: `INV-${inv.id.substring(0, 8).toUpperCase()}`,
        receiptNo: `REC-${inv.id.substring(0, 8).toUpperCase()}`,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        remainingBalance: Number(inv.remainingBalance),
        status: inv.status,
        paymentMethod: inv.paymentMethod || 'UPI',
        transactionId,
        description: inv.description || 'School Fees Statement',
        academicYear: inv.opportunity?.academicYear?.name || '2026-2027',
        className: student.classSection?.class.name || inv.opportunity?.class?.name || 'N/A',
        sectionName: student.classSection?.section.name || inv.opportunity?.section?.name || 'N/A',
        studentName: student.user.name,
        rollNo: student.rollNo || 'N/A',
        fatherName: student.fatherName || 'N/A',
        motherName: student.motherName || 'N/A',
        items: inv.invoiceItems.map(item => ({
          id: item.id,
          name: item.name,
          amount: Number(item.amount),
          oliId: item.opportunityLineItemId,
          productId: item.productId,
          selectable: false,
        })),
      };
    });
    // Read open opportunity line items and return both PAID and UNPAID fee products
    const openOppId = billingSummary.account?.opportunities?.[0]?.id;
    const hasUnpaidDbInvoice = mappedInvoices.some(inv => inv.status !== 'PAID' && inv.status !== 'VOIDED');

    if (!hasUnpaidDbInvoice && openOppId) {
      const activeOpp = await this.prisma.opportunity.findUnique({
        where: { id: openOppId },
        include: {
          academicYear: true,
          opportunityLineItems: {
            include: { product: true }
          }
        }
      });

      if (activeOpp) {
        // Query all non-voided paid invoice items to determine item-level paid amounts
        const existingInvoiceItems = await this.prisma.invoiceItem.findMany({
          where: {
            tenantId: student.tenantId,
            invoice: {
              studentId: student.id,
              status: { not: PaymentStatus.VOIDED },
            },
          },
        });

        const oliPaidMap = new Map<string, number>();
        const namePaidMap = new Map<string, number>();

        for (const item of existingInvoiceItems) {
          if (item.opportunityLineItemId) {
            const cur = oliPaidMap.get(item.opportunityLineItemId) || 0;
            oliPaidMap.set(item.opportunityLineItemId, cur + Number(item.amount));
          }
          if (item.name) {
            const cur = namePaidMap.get(item.name.toLowerCase()) || 0;
            namePaidMap.set(item.name.toLowerCase(), cur + Number(item.amount));
          }
        }

        const allFeeProducts: any[] = [];
        let statementPendingTotal = 0;

        for (const oli of activeOpp.opportunityLineItems) {
          const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
          const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
          const netAmount = itemTotal - itemDiscount;

          const paidByOli = oliPaidMap.get(oli.id) || 0;
          const paidByName = namePaidMap.get((oli.product?.name || '').toLowerCase()) || 0;
          const paidAmount = Math.max(paidByOli, paidByName);
          const balanceDue = Math.max(0, netAmount - paidAmount);

          if (balanceDue > 0) {
            statementPendingTotal += balanceDue;
          }

          allFeeProducts.push({
            id: oli.id,
            name: oli.product?.name || 'Fee Component',
            amount: netAmount,
            balance: balanceDue,
            paidAmount,
            status: balanceDue === 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
            isSelectable: balanceDue > 0,
            oliId: oli.id,
            productId: oli.productId,
          });
        }

        if (billingSummary.previousYearPending > 0) {
          statementPendingTotal += billingSummary.previousYearPending;
          allFeeProducts.push({
            id: 'PREV_YEAR_DUE_CF',
            name: 'Previous Years Carried Forward Dues',
            amount: billingSummary.previousYearPending,
            balance: billingSummary.previousYearPending,
            paidAmount: 0,
            status: 'UNPAID',
            isSelectable: true,
            oliId: 'PREV_YEAR_DUE_CF',
            productId: 'PREV_YEAR_DUE_CF',
          });
        }

        // Include open fee statement, keeping paid items visible as read-only/non-selectable
        if (allFeeProducts.length > 0) {
          mappedInvoices.unshift({
            id: `OPP-${activeOpp.id}`,
            opportunityId: activeOpp.id,
            invoiceNo: `STMT-${student.rollNo || student.id.substring(0, 5).toUpperCase()}`,
            receiptNo: 'REC-PENDING',
            invoiceDate: new Date(),
            dueDate: activeOpp.closeDate || new Date(),
            totalAmount: statementPendingTotal,
            paidAmount: billingSummary.paidAmount,
            remainingBalance: statementPendingTotal,
            status: statementPendingTotal === 0 ? 'PAID' : (billingSummary.paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
            paymentMethod: 'UPI',
            transactionId: 'N/A',
            description: `Academic Fee Statement ${activeOpp.academicYear?.name || '2026-2027'}`,
            academicYear: activeOpp.academicYear?.name || '2026-2027',
            className: student.classSection?.class.name || 'N/A',
            sectionName: student.classSection?.section.name || 'N/A',
            studentName: student.user.name,
            rollNo: student.rollNo || 'N/A',
            fatherName: student.fatherName || 'N/A',
            motherName: student.motherName || 'N/A',
            items: allFeeProducts,
          } as any);
        }
      }
    }

    return {
      summary: billingSummary,
      invoices: mappedInvoices,
      paymentDetails: tenantDetails,
    };
  }

  async generateInvoicePdf(userId: string, studentId: string, invoiceId: string, res: any) {
    const student = await this.verifyOwnership(userId, studentId);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.studentId !== student.id || invoice.tenantId !== student.tenantId) {
      throw new NotFoundException('Invoice receipt not found.');
    }

    const pdfData = await this.billingService.getInvoicePDFData(invoiceId);
    return this.billingService.generateReceiptPdfStream(pdfData, res);
  }


  /**
   * Pay an invoice (or open-opportunity fee statement) for a student.
   *
   * Accepts `itemAmounts` – an array of { id: oliId, amount: number } – for
   * per-product partial payments, allowing parents to pay any amount ≤ balance.
   * Falls back to the legacy full-invoice path when `itemAmounts` is absent.
   */
  async payInvoice(userId: string, studentId: string, invoiceId: string, data: any) {
    const student = await this.verifyOwnership(userId, studentId);
    const { paymentMethod: method, itemAmounts } = data;

    // ── Per-product partial payment path ────────────────────────────────────
    if (Array.isArray(itemAmounts) && itemAmounts.length > 0) {
      // Basic input validation
      for (const entry of itemAmounts) {
        if (!entry.id || typeof entry.amount !== 'number' || entry.amount <= 0) {
          throw new BadRequestException(`Invalid payment data for item ${entry.id || 'unknown'}.`);
        }
      }

      // Fetch the active opportunity to resolve OLI details
      const billingSummary = await this.billingService.getStudentById(studentId);
      const openOppId = billingSummary.account?.opportunities?.[0]?.id;

      let activeOpp: any = null;
      if (openOppId) {
        activeOpp = await this.prisma.opportunity.findUnique({
          where: { id: openOppId },
          include: {
            academicYear: true,
            opportunityLineItems: { include: { product: true } },
          },
        });
      }

      // Build a map of oliId → (name, productId, netAmount) for validation and naming
      const oliMap = new Map<string, { name: string; productId: string; netAmount: number }>();
      if (activeOpp) {
        for (const oli of activeOpp.opportunityLineItems) {
          const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
          const discount = (itemTotal * Number(oli.discount)) / 100;
          oliMap.set(oli.id, {
            name: oli.product?.name || 'Fee Component',
            productId: oli.productId,
            netAmount: itemTotal - discount,
          });
        }
      }

      // Compute already-paid amounts per OLI from non-voided invoices
      const existingInvoiceItems = await this.prisma.invoiceItem.findMany({
        where: {
          tenantId: student.tenantId,
          invoice: {
            studentId: student.id,
            status: { not: PaymentStatus.VOIDED },
          },
        },
      });

      const oliPaidMap = new Map<string, number>();
      for (const item of existingInvoiceItems) {
        if (item.opportunityLineItemId) {
          const cur = oliPaidMap.get(item.opportunityLineItemId) || 0;
          oliPaidMap.set(item.opportunityLineItemId, cur + Number(item.amount));
        }
      }

      // Validate that each requested amount does not exceed the remaining balance
      for (const entry of itemAmounts) {
        const oliInfo = oliMap.get(entry.id);
        if (!oliInfo) {
          // Allow PREV_YEAR_DUE_CF as a passthrough without OLI validation
          if (entry.id !== 'PREV_YEAR_DUE_CF') {
            throw new BadRequestException(`Fee product ${entry.id} not found.`);
          }
          continue;
        }
        const alreadyPaid = oliPaidMap.get(entry.id) || 0;
        const balance = Math.max(0, oliInfo.netAmount - alreadyPaid);
        if (balance === 0) {
          throw new BadRequestException(`Fee product "${oliInfo.name}" is already fully paid.`);
        }
        if (entry.amount > balance) {
          throw new BadRequestException(
            `Payment amount ₹${entry.amount} for "${oliInfo.name}" exceeds the remaining balance of ₹${balance}.`,
          );
        }
      }

      // Process payment through gateway
      const totalPayAmount = itemAmounts.reduce((s: number, e: any) => s + e.amount, 0);
      const txnResult = await this.paymentProcessor.processPayment(
        totalPayAmount,
        method,
        invoiceId,
      );
      if (!txnResult.success) {
        throw new BadRequestException('Payment gateway transaction rejected.');
      }

      // Build invoice items payload
      const invoiceItemsData = itemAmounts.map((entry: any) => {
        const oliInfo = oliMap.get(entry.id);
        return {
          name: oliInfo?.name || (entry.id === 'PREV_YEAR_DUE_CF' ? 'Previous Years Carried Forward Dues' : 'Fee Component'),
          amount: entry.amount,
          opportunityLineItemId: entry.id !== 'PREV_YEAR_DUE_CF' ? entry.id : null,
          productId: oliInfo?.productId || null,
          tenantId: student.tenantId,
        };
      });

      // Create a new Invoice record for this payment session
      const createdInvoice = await this.prisma.invoice.create({
        data: {
          studentId: student.id,
          tenantId: student.tenantId,
          opportunityId: activeOpp?.id || null,
          totalAmount: totalPayAmount,
          paidAmount: totalPayAmount,
          remainingBalance: 0,
          status: PaymentStatus.PAID,
          paymentMethod: method === 'BANK' ? 'BANK_TRANSFER' : 'UPI',
          invoiceDate: new Date(),
          dueDate: activeOpp?.closeDate || new Date(),
          description: `Partial Fee Payment – ${student.user.name} (${new Date().toLocaleDateString()})`,
          invoiceItems: { create: invoiceItemsData },
        },
        include: { invoiceItems: true },
      });

      // Update opportunity totalPaidAmount
      if (activeOpp?.id) {
        const allOppInvoices = await this.prisma.invoice.findMany({
          where: {
            opportunityId: activeOpp.id,
            tenantId: student.tenantId,
            status: { not: PaymentStatus.VOIDED },
          },
        });
        const newTotalPaid = allOppInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
        await this.prisma.opportunity.update({
          where: { id: activeOpp.id },
          data: { totalPaidAmount: newTotalPaid },
        }).catch(err => console.error('Failed to update opportunity totalPaidAmount:', err));
      }

      // Audit log
      const txnId = txnResult.transactionId;
      await this.logAction(userId, student.tenantId, 'FEE_PAYMENT', 'Invoice', createdInvoice.id, {
        studentId,
        amount: totalPayAmount,
        method,
        transactionId: txnId,
        selectedItemCount: itemAmounts.length,
        items: itemAmounts,
      });

      // Notification
      const parent = await this.getParentProfile(userId);
      await this.createNotification(
        parent.userId,
        'Fee Payment Successful',
        `Payment of ₹${totalPayAmount} received for ${student.user.name}'s selected fee items. Txn: ${txnId}`,
      );

      return {
        success: true,
        message: `Payment of ₹${totalPayAmount.toLocaleString('en-IN')} processed successfully.`,
        invoice: createdInvoice,
        transactionId: txnId,
      };
    }

    // ── Legacy full-invoice payment path (unchanged) ─────────────────────────
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, studentId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === PaymentStatus.PAID || Number(invoice.remainingBalance) === 0) {
      throw new BadRequestException('This fee item has already been paid.');
    }

    const amount = Number(invoice.remainingBalance);
    const txnResult = await this.paymentProcessor.processPayment(amount, method, invoiceId);

    if (!txnResult.success) {
      throw new BadRequestException('Payment gateway transaction rejected.');
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: invoice.totalAmount,
        remainingBalance: 0,
        status: PaymentStatus.PAID,
        paymentMethod: method === 'BANK' ? 'BANK_TRANSFER' : 'UPI',
        description: `${invoice.description || ''} (Paid via Parent Portal ${txnResult.transactionId})`.trim(),
      },
    });

    if (invoice.opportunityId) {
      const oppInvoices = await this.prisma.invoice.findMany({
        where: {
          opportunityId: invoice.opportunityId,
          tenantId: student.tenantId,
          status: { not: PaymentStatus.VOIDED },
        },
      });
      const newTotalPaid = oppInvoices.reduce((sum, inv) => {
        if (inv.id === invoiceId) return sum + Number(invoice.totalAmount);
        return sum + Number(inv.paidAmount);
      }, 0);

      await this.prisma.opportunity.update({
        where: { id: invoice.opportunityId },
        data: { totalPaidAmount: newTotalPaid },
      }).catch(err => console.error('Failed to update opportunity totalPaidAmount:', err));
    }

    await this.logAction(userId, student.tenantId, 'FEE_PAYMENT', 'Invoice', invoiceId, {
      studentId,
      amount,
      method,
      transactionId: txnResult.transactionId,
    });

    const parent = await this.getParentProfile(userId);
    await this.createNotification(
      parent.userId,
      'Fee Payment Successful',
      `Payment of ₹${amount} received for ${student.user.name}'s invoice. Txn: ${txnResult.transactionId}`,
    );

    return {
      success: true,
      message: 'Payment processed and invoice ledger updated successfully.',
      invoice: updatedInvoice,
      transactionId: txnResult.transactionId,
    };
  }

  async getTimetable(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);
    if (!student.classSectionId) return [];

    // 1. Fetch assigned periods for this student's class section
    const periods = await this.prisma.period.findMany({
      where: { classSectionId: student.classSectionId },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        periodTiming: true,
      },
    });

    // 2. Fetch all configured period timings for this school tenant
    let timings = await this.prisma.periodTiming.findMany({
      where: { tenantId: student.tenantId, isActive: true },
      orderBy: { periodNumber: 'asc' },
    });

    if (timings.length === 0) {
      timings = [
        { id: '1', periodNumber: 1, name: 'P1', startTime: '09:00 AM', endTime: '10:00 AM', isBreak: false, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', periodNumber: 2, name: 'P2', startTime: '10:00 AM', endTime: '11:00 AM', isBreak: false, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
        { id: '3', periodNumber: 3, name: 'P3', startTime: '11:00 AM', endTime: '12:00 PM', isBreak: false, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
        { id: '4', periodNumber: 4, name: 'P4', startTime: '12:00 PM', endTime: '01:00 PM', isBreak: false, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
        { id: '5', periodNumber: 5, name: 'Lunch Break', startTime: '01:00 PM', endTime: '02:00 PM', isBreak: true, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
        { id: '6', periodNumber: 6, name: 'P6', startTime: '02:00 PM', endTime: '03:00 PM', isBreak: false, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
        { id: '7', periodNumber: 7, name: 'P7', startTime: '03:00 PM', endTime: '04:00 PM', isBreak: false, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
        { id: '8', periodNumber: 8, name: 'P8', startTime: '04:00 PM', endTime: '05:00 PM', isBreak: false, isActive: true, tenantId: student.tenantId, createdAt: new Date(), updatedAt: new Date() },
      ] as any;
    }

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const result: any[] = [];

    daysOfWeek.forEach(day => {
      const dayPeriods = periods.filter(p => p.dayOfWeek.toLowerCase() === day.toLowerCase());

      let teachingPeriodIndex = 1;

      timings.forEach(timing => {
        const assigned = dayPeriods.find(p => p.periodTimingId === timing.id || p.periodTiming?.periodNumber === timing.periodNumber);

        const isBreak = timing.isBreak ||
          (timing.name && /break|lunch|recess|tea/i.test(timing.name)) ||
          (!assigned && timing.periodNumber === 5);

        if (isBreak) {
          let cleanBreakTitle = timing.name || 'Lunch Break';
          if (/^P\d+$/i.test(cleanBreakTitle) || cleanBreakTitle === `Period ${timing.periodNumber}`) {
            cleanBreakTitle = 'Lunch Break';
          }

          result.push({
            id: `SLOT-${day}-${timing.periodNumber}`,
            day,
            subject: cleanBreakTitle,
            teacher: 'N/A',
            startTime: timing.startTime,
            endTime: timing.endTime,
            periodNumber: null,
            timingOrder: timing.periodNumber,
            isBreak: true,
          });
        } else {
          const currentLecNum = teachingPeriodIndex++;

          if (assigned) {
            result.push({
              id: assigned.id,
              day,
              subject: assigned.subject.name,
              teacher: assigned.teacher?.user?.name || 'Teacher',
              startTime: assigned.periodTiming?.startTime || timing.startTime,
              endTime: assigned.periodTiming?.endTime || timing.endTime,
              periodNumber: currentLecNum,
              timingOrder: timing.periodNumber,
              isBreak: false,
            });
          } else {
            result.push({
              id: `SLOT-${day}-${timing.periodNumber}`,
              day,
              subject: 'Free Period / Recess',
              teacher: 'N/A',
              startTime: timing.startTime,
              endTime: timing.endTime,
              periodNumber: currentLecNum,
              timingOrder: timing.periodNumber,
              isBreak: false,
            });
          }
        }
      });
    });

    return result;
  }

  private sanitizeAnnouncementContent(content?: string): string {
    if (!content) return '';
    return content
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/(?:examScheduleId|debugId|internalId):\s*[0-9a-fA-F-]{36}/gi, '')
      .trim();
  }

  async getAnnouncements(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);

    const announcements = await this.prisma.announcement.findMany({
      where: {
        tenantId: student.tenantId,
        OR: [
          { audienceType: 'INSTITUTION' },
          { classSectionId: student.classSectionId },
        ],
      },
      include: { teacher: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return announcements.map(ann => ({
      ...ann,
      content: this.sanitizeAnnouncementContent(ann.content),
    }));
  }

  async getTeacherComplaints(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);
    return this.prisma.behaviorCase.findMany({
      where: {
        studentId: student.id,
        behaviorType: 'Complaint',
        tenantId: student.tenantId,
      },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getComplaints(userId: string) {
    const parent = await this.getParentProfile(userId);
    const complaints = await this.prisma.complaint.findMany({
      where: { submittedById: parent.userId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const complaintIds = complaints.map(c => c.id);
    const histories = await this.prisma.statusHistory.findMany({
      where: { entityType: 'COMPLAINT', entityId: { in: complaintIds } },
      include: { updatedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const historyMap = new Map<string, any[]>();
    for (const h of histories) {
      if (!historyMap.has(h.entityId)) historyMap.set(h.entityId, []);
      historyMap.get(h.entityId)!.push(h);
    }

    return complaints.map(c => ({
      ...c,
      statusHistories: historyMap.get(c.id) || [],
    }));
  }

  async submitComplaint(userId: string, tenantId: string, data: any) {
    const parent = await this.getParentProfile(userId);
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });

    if (!activeYear) {
      throw new BadRequestException('No active academic year found for tenant');
    }

    const complaint = await this.prisma.complaint.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category || 'General',
        submittedById: parent.userId,
        academicYearId: activeYear.id,
        tenantId,
        status: 'OPEN',
      },
    });

    // Create initial audit trail history
    await this.prisma.statusHistory.create({
      data: {
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        previousStatus: null,
        currentStatus: 'OPEN',
        remarks: 'Ticket Opened',
        updatedById: parent.userId,
        tenantId,
      },
    }).catch(err => console.error('Failed to create status history:', err));

    // Audit log
    await this.logAction(userId, tenantId, 'SUBMIT_COMPLAINT', 'Complaint', complaint.id, {
      title: data.title,
      category: data.category,
    });

    // Confirmation notification to Parent
    await this.createNotification(
      parent.userId,
      'Complaint Ticket Opened',
      `Your complaint "${data.title}" has been registered. Ref: ${complaint.id.substring(0, 8).toUpperCase()}`,
    );

    // Real-time Notification to all School Admins for tenant
    const schoolAdmins = await this.prisma.user.findMany({
      where: { tenantId, role: Role.SCHOOL_ADMIN, isActive: true },
      select: { id: true },
    });

    for (const adminUser of schoolAdmins) {
      await this.createNotification(
        adminUser.id,
        `New Complaint Submitted`,
        `Parent ${parent.user.name} submitted a complaint: "${data.title}" (Category: ${data.category || 'General'}).\nComplaintId: ${complaint.id}`,
        'COMPLAINT_UPDATE',
      ).catch(err => console.error('Failed to notify admin of complaint:', err));
    }

    return complaint;
  }

  async getTransport(userId: string, studentId: string) {
    await this.verifyOwnership(userId, studentId);

    return {
      busNumber: 'MH-12-FE-4321',
      driverName: 'Sanjay Shinde',
      driverPhone: '+91 9881726354',
      route: 'Route A - Kharadi to Viman Nagar',
      pickupTime: '07:45 AM',
      dropTime: '02:30 PM',
      liveGPS: {
        latitude: 18.5529,
        longitude: 73.9312,
        etaMinutes: 8,
      },
    };
  }

  async submitLeaveRequest(userId: string, studentId: string, data: any) {
    const student = await this.verifyOwnership(userId, studentId);
    const parent = await this.getParentProfile(userId);

    // Upload medical certificate attachment if present
    let attachmentUrl = null;
    if (data.base64File) {
      attachmentUrl = await this.storageService.uploadImage(
        data.base64File,
        student.tenantId,
        studentId,
        'leave-attachment',
      );
    }

    // Persistent storage of leave request in LeaveRequest DB table
    const leave = await this.prisma.leaveRequest.create({
      data: {
        applicantType: 'STUDENT',
        studentId: student.id,
        classSectionId: student.classSectionId,
        submittedById: parent.userId,
        leaveType: data.leaveType || 'Medical',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        attachment: attachmentUrl,
        status: 'PENDING',
        tenantId: student.tenantId,
      },
    });

    // Create initial audit trail history
    await this.prisma.statusHistory.create({
      data: {
        entityType: 'LEAVE_REQUEST',
        entityId: leave.id,
        previousStatus: null,
        currentStatus: 'PENDING',
        remarks: 'Submitted by Parent',
        updatedById: parent.userId,
        tenantId: student.tenantId,
      },
    }).catch(err => console.error('Failed to create status history for leave:', err));

    // Audit log
    await this.logAction(userId, student.tenantId, 'SUBMIT_LEAVE', 'Student', studentId, {
      leaveId: leave.id,
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      attachmentUrl,
      status: 'PENDING',
    });

    // Confirmation notification to Parent
    await this.createNotification(
      parent.userId,
      'Leave Application Received',
      `Leave request submitted for ${student.user.name} from ${data.startDate} to ${data.endDate}.`,
    );

    // Real-time Notification to School Admins
    const schoolAdmins = await this.prisma.user.findMany({
      where: { tenantId: student.tenantId, role: Role.SCHOOL_ADMIN, isActive: true },
      select: { id: true },
    });

    for (const adminUser of schoolAdmins) {
      await this.createNotification(
        adminUser.id,
        `New Leave Application: ${student.user.name}`,
        `New Leave Application submitted by Parent for Student ${student.user.name}.\nType: ${data.leaveType}\nFrom: ${data.startDate}\nTo: ${data.endDate}\nReason: ${data.reason}\nLeaveRequestId: ${leave.id}`,
        'LEAVE_APPROVAL',
      ).catch(err => console.error('Failed to notify admin of leave:', err));
    }

    // Real-time Notification to Class Teacher (if assigned)
    if (student.classSectionId) {
      const classSec = await this.prisma.classSection.findUnique({
        where: { id: student.classSectionId },
        include: { teacher: { select: { userId: true } } },
      });
      if (classSec?.teacher?.userId) {
        await this.createNotification(
          classSec.teacher.userId,
          `Student Leave Application: ${student.user.name}`,
          `Leave Application submitted for Student ${student.user.name}.\nType: ${data.leaveType}\nFrom: ${data.startDate}\nTo: ${data.endDate}\nReason: ${data.reason}\nLeaveRequestId: ${leave.id}`,
          'LEAVE_APPROVAL',
        ).catch(err => console.error('Failed to notify teacher of leave:', err));
      }
    }

    return {
      success: true,
      message: 'Leave application submitted successfully.',
      requestId: leave.id,
      attachmentUrl,
      leave,
    };
  }

  async getLeavesHistory(userId: string, studentId: string) {
    const student = await this.verifyOwnership(userId, studentId);
    const parent = await this.getParentProfile(userId);

    // Query LeaveRequest DB records for this student or submitted by parent
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId: student.tenantId,
        OR: [
          { studentId: student.id },
          { submittedById: parent.userId },
        ],
      },
      include: {
        approvedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const leaveIds = leaves.map(l => l.id);
    const histories = await this.prisma.statusHistory.findMany({
      where: { entityType: 'LEAVE_REQUEST', entityId: { in: leaveIds } },
      include: { updatedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const historyMap = new Map<string, any[]>();
    for (const h of histories) {
      if (!historyMap.has(h.entityId)) historyMap.set(h.entityId, []);
      historyMap.get(h.entityId)!.push(h);
    }

    return leaves.map(l => ({
      id: l.id,
      leaveType: l.leaveType,
      startDate: l.startDate ? l.startDate.toISOString().split('T')[0] : '',
      endDate: l.endDate ? l.endDate.toISOString().split('T')[0] : '',
      reason: l.reason,
      status: l.status,
      attachmentUrl: l.attachment,
      comments: l.comments,
      approvedBy: l.approvedBy ? l.approvedBy.name : l.approver,
      approvedRole: l.approvedRole || (l.approvedBy ? (l.approvedBy.role === Role.SCHOOL_ADMIN ? 'Admin' : 'Teacher') : null),
      approvedDate: l.approvedDate ? l.approvedDate.toISOString().split('T')[0] : (l.rejectedDate ? l.rejectedDate.toISOString().split('T')[0] : null),
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      statusHistories: historyMap.get(l.id) || [],
    }));
  }
}
