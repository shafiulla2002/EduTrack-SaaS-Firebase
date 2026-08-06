import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Role } from '@prisma/client';
import { RoleFilterHelper } from '../common/role-filter.helper';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private roleFilterHelper: RoleFilterHelper,
  ) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  private dashboardCache = new Map<string, { data: any; expiresAt: number }>();

  async getDashboardSummary() {
    const tenantId = this.getTenantId();
    const cacheKey = `dashboard-summary-${tenantId}`;
    const cached = this.dashboardCache.get(cacheKey);
    const nowTime = Date.now();

    if (cached && cached.expiresAt > nowTime) {
      return cached.data;
    }

    // Prepare date ranges for last 6 months
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      last6Months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
      });
    }

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Execute queries in batches to prevent connection pool timeouts
    const [
      studentsCount,
      teachersCount,
      classesCount,
      revenueAgg,
      expenseAgg,
      sessions,
      marks,
      examSubjectsConfig,
      leavesList
    ] = await Promise.all([
      // 1. Total Students
      this.prisma.studentProfile.count({
        where: {
          user: {
            tenantId,
            isActive: true,
          },
        },
      }),

      // 2. Total Teachers
      this.prisma.staffProfile.count({
        where: {
          user: {
            tenantId,
            isActive: true,
            role: { in: ['TEACHER', 'STAFF'] },
          },
        },
      }),

      // 3. Total Classes
      this.prisma.classSection.count({
        where: {
          tenantId,
          class: {
            isActive: true,
          },
        },
      }),

      // 4. Total Revenue
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          status: 'PAID',
        },
        _sum: {
          paidAmount: true,
        },
      }),

      // 5. Total Expenses
      this.prisma.expense.aggregate({
        where: {
          tenantId,
          status: 'PAID',
        },
        _sum: {
          amount: true,
        },
      }),

      // 6. Average Attendance Rate
      this.prisma.attendanceSession.findMany({
        where: { tenantId },
        select: { presentCount: true, totalStudents: true },
      }),

      // 7. Avg. Academic Score
      this.prisma.examMark.findMany({
        where: { tenantId },
        select: { examId: true, subjectId: true, subjectType: true, marksObtained: true },
      }),
      
      // 7.1 Exam Subjects for Max Marks
      this.prisma.examSubject.findMany({
        where: { tenantId },
        select: { examId: true, subjectId: true, subjectType: true, maxMarks: true },
      }),

      // 7b. Leave requests
      this.prisma.leaveRequest.findMany({
        where: { tenantId },
        select: { status: true, approvedDate: true, rejectedDate: true }
      })
    ]);

    const [
      recentStudents,
      invoices,
      salaryExpenses,
      studentsThisMonth,
      studentsLastMonth,
      revThisMonthAgg,
      revLastMonthAgg
    ] = await Promise.all([
      // 8. Recent Admissions
      this.prisma.studentProfile.findMany({
        where: {
          user: {
            tenantId,
            isActive: true,
          },
        },
        orderBy: {
          user: {
            createdAt: 'desc',
          },
        },
        take: 10,
        include: {
          user: true,
          classSection: {
            include: {
              class: true,
              section: true,
            },
          },
        },
      }),

      // 9. Recent Payments - Invoices
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: 'PAID',
        },
        include: {
          student: {
            include: { user: true },
          },
        },
        orderBy: {
          invoiceDate: 'desc',
        },
        take: 10,
      }),

      // 9b. Recent Payments - Salary Expenses
      this.prisma.expense.findMany({
        where: {
          tenantId,
          category: 'Salary',
          status: 'PAID',
        },
        orderBy: {
          date: 'desc',
        },
        take: 10,
      }),

      // 11. Trend Students This Month
      this.prisma.studentProfile.count({
        where: { user: { tenantId, isActive: true, createdAt: { gte: thisMonthStart } } },
      }),

      // 11b. Trend Students Last Month
      this.prisma.studentProfile.count({
        where: { user: { tenantId, isActive: true, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } },
      }),

      // 11c. Trend Revenue This Month
      this.prisma.invoice.aggregate({
        where: { tenantId, status: 'PAID', invoiceDate: { gte: thisMonthStart } },
        _sum: { paidAmount: true },
      }),

      // 11d. Trend Revenue Last Month
      this.prisma.invoice.aggregate({
        where: { tenantId, status: 'PAID', invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { paidAmount: true },
      })
    ]);

    // 10. Chart Data (Monthly collections & salaries aggregated in-memory)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [monthlyInvoices, monthlyExpenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: 'PAID',
          invoiceDate: { gte: sixMonthsAgo },
        },
        select: { paidAmount: true, invoiceDate: true },
      }),
      this.prisma.expense.findMany({
        where: {
          tenantId,
          category: 'Salary',
          status: 'PAID',
          date: { gte: sixMonthsAgo },
        },
        select: { amount: true, date: true },
      })
    ]);

    const totalRevenue = Number(revenueAgg._sum.paidAmount || 0);
    const totalExpenses = Number(expenseAgg._sum.amount || 0);
    const netIncome = totalRevenue - totalExpenses;

    const totalPresent = sessions.reduce((sum, s) => sum + s.presentCount, 0);
    const totalRoster = sessions.reduce((sum, s) => sum + s.totalStudents, 0);
    const attendanceRate = totalRoster > 0 ? Math.round((totalPresent / totalRoster) * 1000) / 10 : 0;

    const examSubMap = new Map(examSubjectsConfig.map(es => [`${es.examId}_${es.subjectId}_${es.subjectType}`, es.maxMarks]));
    let totalPct = 0;
    marks.forEach(m => {
      const max = examSubMap.get(`${m.examId}_${m.subjectId}_${m.subjectType}`) || 100;
      totalPct += max > 0 ? (Number(m.marksObtained) / max) * 100 : 0;
    });

    const academicAverage = marks.length > 0
      ? Math.round((totalPct / marks.length) * 10) / 10
      : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const pendingLeaveRequests = leavesList.filter((l: any) => l.status === 'PENDING').length;
    const approvedToday = leavesList.filter((l: any) => l.status === 'APPROVED' && l.approvedDate && l.approvedDate.toISOString().split('T')[0] === todayStr).length;
    const rejectedToday = leavesList.filter((l: any) => l.status === 'REJECTED' && l.rejectedDate && l.rejectedDate.toISOString().split('T')[0] === todayStr).length;

    const recentAdmissions = recentStudents.map(s => ({
      id: s.id,
      name: s.user.name,
      avatar: s.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      class: s.classSection ? `${s.classSection.class.name} - ${s.classSection.section.name}` : 'Unassigned',
      rollNo: s.rollNo || 'N/A',
      joiningDate: s.user.createdAt.toISOString().split('T')[0],
      status: 'Active',
    }));

    const studentPayments = invoices.map(inv => ({
      id: inv.id,
      type: 'Fee Payment',
      name: `${inv.student.user.name} - Tuition Fees`,
      amount: Number(inv.paidAmount),
      date: inv.invoiceDate.toISOString().split('T')[0],
      status: 'Paid',
    }));

    const salaryPayments = salaryExpenses.map(exp => ({
      id: exp.id,
      type: 'Salary Payment',
      name: exp.description || 'Staff Salary Disbursement',
      amount: Number(exp.amount),
      date: exp.date.toISOString().split('T')[0],
      status: 'Paid',
    }));

    // Combine and sort by date descending
    const recentPayments = [...studentPayments, ...salaryPayments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // Aggregate monthly data in-memory
    const chartData = last6Months.map(m => {
      const collections = monthlyInvoices
        .filter(inv => inv.invoiceDate.getFullYear() === m.year && inv.invoiceDate.getMonth() === m.month)
        .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

      const salaries = monthlyExpenses
        .filter(exp => exp.date.getFullYear() === m.year && exp.date.getMonth() === m.month)
        .reduce((sum, exp) => sum + Number(exp.amount), 0);

      return {
        month: m.label,
        feeCollection: collections,
        salaryExpense: salaries,
        netRevenue: collections - salaries,
      };
    });

    const studentTrendVal = studentsLastMonth > 0 
      ? ((studentsThisMonth - studentsLastMonth) / studentsLastMonth) * 100
      : studentsThisMonth > 0 ? 100 : 0;

    const revThisMonth = Number(revThisMonthAgg._sum.paidAmount || 0);
    const revLastMonth = Number(revLastMonthAgg._sum.paidAmount || 0);
    const revenueTrendVal = revLastMonth > 0 
      ? ((revThisMonth - revLastMonth) / revLastMonth) * 100
      : revThisMonth > 0 ? 100 : 0;

    const summaryData = {
      stats: {
        studentsCount,
        teachersCount,
        classesCount,
        totalRevenue,
        totalExpenses,
        netIncome,
        attendanceRate,
        academicAverage,
        pendingLeaveRequests,
        approvedToday,
        rejectedToday,
        trends: {
          students: {
            value: Math.abs(Math.round(studentTrendVal * 10) / 10) + '%',
            isUp: studentTrendVal >= 0,
          },
          revenue: {
            value: Math.abs(Math.round(revenueTrendVal * 10) / 10) + '%',
            isUp: revenueTrendVal >= 0,
          },
          attendance: {
            value: '1.5%',
            isUp: true,
          },
          academic: {
            value: '0.8%',
            isUp: false,
          },
        },
      },
      recentAdmissions,
      recentPayments,
      chartData,
    };

    this.dashboardCache.set(cacheKey, {
      data: summaryData,
      expiresAt: nowTime + 30 * 1000, // Cache for 30 seconds
    });

    return summaryData;
  }

  async getReportsSummary(userId?: string, role?: string) {
    const tenantId = this.getTenantId();

    let studentWhere: any = { user: { tenantId, isActive: true } };
    let marksWhere: any = { tenantId };
    let showFinancials = true;

    if (this.roleFilterHelper.isTeacher(role)) {
      showFinancials = false;
      try {
        const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
        const classSectionIds = scope.assignedClassSectionIds;
        studentWhere = {
          tenantId,
          classSectionId: { in: classSectionIds },
          user: { isActive: true },
        };
        marksWhere = {
          tenantId,
          student: { classSectionId: { in: classSectionIds } },
        };
      } catch {
        studentWhere = { id: 'none' };
        marksWhere = { id: 'none' };
      }
    }

    // 1. Enrollment Demographics (Student counts grouped by class)
    const students = await this.prisma.studentProfile.findMany({
      where: studentWhere,
      include: {
        user: { select: { createdAt: true } },
        classSection: {
          include: { class: true, section: true }
        }
      }
    });

    const classDistribution: Record<string, number> = {};
    students.forEach(s => {
      const className = s.classSection?.class.name || 'Unassigned';
      classDistribution[className] = (classDistribution[className] || 0) + 1;
    });

    const timelineGroups: Record<string, number> = {};
    students.forEach(s => {
      const dateStr = s.user.createdAt.toISOString().slice(0, 7); // YYYY-MM
      timelineGroups[dateStr] = (timelineGroups[dateStr] || 0) + 1;
    });
    const timeline = Object.entries(timelineGroups)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const demographics = {
      totalStudents: students.length,
      classDistribution,
      timeline
    };

    // 2. Financial Statements (Paid revenue, outstanding balances, salaries paid)
    let financials = {
      totalRevenue: 0,
      outstandingReceivables: 0,
      totalExpenses: 0,
      netCashflow: 0
    };

    if (showFinancials) {
      const [invoices, expenses] = await Promise.all([
        this.prisma.invoice.findMany({
          where: { tenantId }
        }),
        this.prisma.expense.findMany({
          where: { tenantId, status: 'PAID' }
        })
      ]);

      let totalRevenue = 0;
      let outstandingReceivables = 0;
      invoices.forEach(inv => {
        totalRevenue += Number(inv.paidAmount || 0);
        outstandingReceivables += Number(inv.remainingBalance || 0);
      });

      let totalExpenses = 0;
      expenses.forEach(exp => {
        totalExpenses += Number(exp.amount || 0);
      });

      financials = {
        totalRevenue,
        outstandingReceivables,
        totalExpenses,
        netCashflow: totalRevenue - totalExpenses
      };
    }

    // 3. Grading Averages & Mark Distribution curve
    const [marks, examSubjects] = await Promise.all([
      this.prisma.examMark.findMany({
        where: marksWhere
      }),
      this.prisma.examSubject.findMany({
        where: { tenantId }
      })
    ]);
    
    const subjectConfigMap = new Map(examSubjects.map(es => [`${es.examId}_${es.subjectId}_${es.subjectType}`, es]));

    let totalPctScore = 0;
    let passedCount = 0;
    let failedCount = 0;
    const distribution = {
      failed: 0, // < 35
      belowAverage: 0, // 35 - 60
      average: 0, // 60 - 75
      firstDivision: 0, // 75 - 90
      highDistinction: 0 // 90 - 100
    };

    marks.forEach(m => {
      const score = Number(m.marksObtained);
      const es = subjectConfigMap.get(`${m.examId}_${m.subjectId}_${m.subjectType}`);
      const maxMarks = es ? es.maxMarks : 100;
      const passingPct = es ? Number(es.passingPercentage) : 35;
      
      const pct = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
      totalPctScore += pct;

      if (pct < passingPct) {
        failedCount++;
        distribution.failed++;
      } else {
        passedCount++;
        if (pct >= passingPct && pct < 60) distribution.belowAverage++;
        else if (pct >= 60 && pct < 75) distribution.average++;
        else if (pct >= 75 && pct < 90) distribution.firstDivision++;
        else if (pct >= 90) distribution.highDistinction++;
      }
    });

    const totalMarksEntries = marks.length;
    const averageScore = totalMarksEntries > 0 ? (totalPctScore / totalMarksEntries) : 0;
    const passRate = totalMarksEntries > 0 ? (passedCount / totalMarksEntries) * 100 : 0;

    const grading = {
      averageScore: Math.round(averageScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      distribution
    };

    return {
      demographics,
      financials,
      grading
    };
  }

  async getDemographicsReport(userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    let studentWhere: any = { user: { tenantId, isActive: true } };

    if (this.roleFilterHelper.isTeacher(role)) {
      try {
        const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
        studentWhere = {
          tenantId,
          classSectionId: { in: scope.assignedClassSectionIds },
          user: { isActive: true },
        };
      } catch {
        studentWhere = { id: 'none' };
      }
    }

    const students = await this.prisma.studentProfile.findMany({
      where: studentWhere,
      include: {
        user: { select: { name: true, email: true, phone: true, createdAt: true } },
        classSection: {
          include: { class: true, section: true }
        }
      }
    });

    return students.map(s => ({
      name: s.user.name,
      email: s.user.email || 'N/A',
      phone: s.user.phone || 'N/A',
      class: s.classSection?.class.name || 'Unassigned',
      section: s.classSection?.section.name || 'Unassigned',
      rollNo: s.rollNo || 'N/A',
      joiningDate: s.user.createdAt.toISOString().split('T')[0]
    }));
  }

  async getCashflowsReport(userId?: string, role?: string) {
    // Teachers should not see cashflows
    if (role === Role.TEACHER) {
      return [];
    }

    const tenantId = this.getTenantId();
    const [invoices, expenses] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId },
        include: { student: { include: { user: { select: { name: true } } } } }
      }),
      this.prisma.expense.findMany({
        where: { tenantId, status: 'PAID' }
      })
    ]);

    const txs: any[] = [];
    invoices.forEach(inv => {
      txs.push({
        type: 'Fee Revenue',
        name: inv.student?.user.name || 'Student Fee',
        amount: Number(inv.paidAmount),
        date: inv.invoiceDate.toISOString().split('T')[0],
        status: inv.status
      });
      if (Number(inv.remainingBalance) > 0) {
        txs.push({
          type: 'Receivable Outstanding',
          name: inv.student?.user.name || 'Student Fee',
          amount: Number(inv.remainingBalance),
          date: inv.dueDate.toISOString().split('T')[0],
          status: 'UNPAID'
        });
      }
    });

    expenses.forEach(exp => {
      txs.push({
        type: 'School Expense',
        name: exp.description || exp.category || 'Vendor Payment',
        amount: -Number(exp.amount),
        date: exp.date.toISOString().split('T')[0],
        status: 'PAID'
      });
    });

    return txs;
  }

  async getGradingReport(userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    let marksWhere: any = { tenantId };

    if (this.roleFilterHelper.isTeacher(role)) {
      try {
        const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
        marksWhere = {
          tenantId,
          student: { classSectionId: { in: scope.assignedClassSectionIds } },
        };
      } catch {
        marksWhere = { id: 'none' };
      }
    }

    const [marks, examSubjects] = await Promise.all([
      this.prisma.examMark.findMany({
        where: marksWhere,
        include: {
          student: { include: { user: { select: { name: true } } } },
          subject: { select: { name: true } },
          exam: { select: { type: true } }
        }
      }),
      this.prisma.examSubject.findMany({
        where: { tenantId }
      })
    ]);
    
    const subjectConfigMap = new Map(examSubjects.map(es => [`${es.examId}_${es.subjectId}_${es.subjectType}`, es]));

    return marks.map(m => {
      const es = subjectConfigMap.get(`${m.examId}_${m.subjectId}_${m.subjectType}`);
      const maxMarks = es ? es.maxMarks : 100;
      
      return {
        studentName: m.student?.user.name || 'Student',
        rollNo: m.student?.rollNo || 'N/A',
        subject: m.subject?.name || 'Subject',
        subjectType: m.subjectType,
        examType: m.exam?.type || 'Exam',
        marksObtained: Number(m.marksObtained),
        maxMarks: maxMarks
      };
    });
  }

  /**
   * Super Admin Platform Dashboard Aggregations
   */
  async getPlatformMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalRevenueAgg,
      todayRevenueAgg,
      monthlyRevenueAgg,
      annualRevenueAgg,
      totalSchools,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      gracePeriodSubscriptions,
      renewalsDueThisMonth,
      failedPaymentsCount,
      successfulPaymentsCount
    ] = await Promise.all([
      this.prisma.subscriptionPayment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: yearStart } },
        _sum: { amount: true },
      }),
      this.prisma.tenant.count(),
      this.prisma.tenantSubscription.count({
        where: { status: { in: ['ACTIVE', 'RENEWED'] } },
      }),
      this.prisma.tenantSubscription.count({
        where: { status: 'TRIAL' },
      }),
      this.prisma.tenantSubscription.count({
        where: { status: 'EXPIRED' },
      }),
      this.prisma.tenantSubscription.count({
        where: { status: 'GRACE_PERIOD' },
      }),
      this.prisma.tenantSubscription.count({
        where: { expiryDate: { gte: monthStart, lte: monthEnd } },
      }),
      this.prisma.subscriptionPayment.count({
        where: { status: 'FAILED' },
      }),
      this.prisma.subscriptionPayment.count({
        where: { status: 'SUCCESS' },
      }),
    ]);

    const totalRevenue = Number(totalRevenueAgg._sum.amount || 0);
    const todayRevenue = Number(todayRevenueAgg._sum.amount || 0);
    const monthlyRevenue = Number(monthlyRevenueAgg._sum.amount || 0);
    const annualRevenue = Number(annualRevenueAgg._sum.amount || 0);

    const totalPaymentAttempts = successfulPaymentsCount + failedPaymentsCount;
    const renewalSuccessRate = totalPaymentAttempts > 0
      ? Math.round((successfulPaymentsCount / totalPaymentAttempts) * 1000) / 10
      : 100;

    const mrr = Math.round(monthlyRevenue);

    return {
      metrics: {
        totalRevenue,
        todayRevenue,
        monthlyRevenue,
        annualRevenue,
        mrr,
        totalSchools,
        activeSchools: activeSubscriptions,
        trialSchools: trialSubscriptions,
        expiredSchools: expiredSubscriptions,
        gracePeriodSchools: gracePeriodSubscriptions,
        renewalsDueThisMonth,
        failedPayments: failedPaymentsCount,
        renewalSuccessRate: `${renewalSuccessRate}%`,
        activeSubscriptions,
        trialConversions: activeSubscriptions,
      },
    };
  }
}

