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

  invalidateCache(tenantId?: string) {
    if (tenantId) {
      this.dashboardCache.delete(`dashboard-summary-${tenantId}`);
    } else {
      this.dashboardCache.clear();
    }
  }

  async getDashboardSummary() {
    const tenantId = this.getTenantId();
    const cacheKey = `dashboard-summary-${tenantId}`;
    const cached = this.dashboardCache.get(cacheKey);
    const nowTime = Date.now();

    if (cached && cached.expiresAt > nowTime) {
      return cached.data;
    }

    // Prepare date ranges for last 6 months
    const last6Months: { year: number; month: number; label: string }[] = [];
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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Execute database-side aggregations and targeted lookups concurrently
    const [
      studentsCount,
      teachersCount,
      classesCount,
      revenueAgg,
      expenseAgg,
      attendanceRaw,
      scoreRaw,
      pendingLeaveRequests,
      approvedToday,
      rejectedToday,
      recentStudents,
      invoices,
      salaryExpenses,
      studentsThisMonth,
      studentsLastMonth,
      revThisMonthAgg,
      revLastMonthAgg,
      monthlyInvoicesRaw,
      monthlyExpensesRaw
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

      // 6. Average Attendance Rate (Database-side SUM aggregation)
      this.prisma.$queryRaw<Array<{ totalPresent: string | number; totalRoster: string | number }>>`
        SELECT 
          COALESCE(SUM("presentCount"), 0)::bigint AS "totalPresent",
          COALESCE(SUM("totalStudents"), 0)::bigint AS "totalRoster"
        FROM "AttendanceSession"
        WHERE "tenantId" = ${tenantId}
      `,

      // 7. Avg. Academic Score (Database-side percentage aggregation)
      this.prisma.$queryRaw<Array<{ avgScore: number | null }>>`
        SELECT 
          COALESCE(
            AVG(
              CASE 
                WHEN es."maxMarks" IS NOT NULL AND es."maxMarks" > 0 
                THEN (em."marksObtained"::float / es."maxMarks"::float) * 100.0
                ELSE em."marksObtained"::float
              END
            ), 
            0
          )::float AS "avgScore"
        FROM "ExamMark" em
        LEFT JOIN "ExamSubject" es 
          ON em."examId" = es."examId" 
          AND em."subjectId" = es."subjectId" 
          AND em."subjectType" = es."subjectType"
          AND em."tenantId" = es."tenantId"
        WHERE em."tenantId" = ${tenantId}
      `,

      // 7b. Leave requests counts (Direct counts)
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'APPROVED', approvedDate: { gte: todayStart } } }),
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'REJECTED', rejectedDate: { gte: todayStart } } }),

      // 8. Recent Admissions (Targeted field selection)
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
        select: {
          id: true,
          rollNo: true,
          user: {
            select: {
              name: true,
              createdAt: true,
            },
          },
          classSection: {
            select: {
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
      }),

      // 9. Recent Payments - Invoices (Targeted field selection)
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: 'PAID',
        },
        select: {
          id: true,
          paidAmount: true,
          invoiceDate: true,
          student: {
            select: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          invoiceDate: 'desc',
        },
        take: 10,
      }),

      // 9b. Recent Payments - Salary Expenses (Targeted field selection)
      this.prisma.expense.findMany({
        where: {
          tenantId,
          category: 'Salary',
          status: 'PAID',
        },
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
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
      }),

      // 12. Monthly chart aggregations in database
      this.prisma.$queryRaw<Array<{ month: string; totalPaid: number }>>`
        SELECT 
          to_char("invoiceDate", 'YYYY-MM') AS "month",
          COALESCE(SUM("paidAmount"), 0)::float AS "totalPaid"
        FROM "Invoice"
        WHERE "tenantId" = ${tenantId} 
          AND status = 'PAID' 
          AND "invoiceDate" >= ${sixMonthsAgo}
        GROUP BY to_char("invoiceDate", 'YYYY-MM')
      `,
      this.prisma.$queryRaw<Array<{ month: string; totalSalary: number }>>`
        SELECT 
          to_char(date, 'YYYY-MM') AS "month",
          COALESCE(SUM(amount), 0)::float AS "totalSalary"
        FROM "Expense"
        WHERE "tenantId" = ${tenantId} 
          AND category = 'Salary' 
          AND status = 'PAID' 
          AND date >= ${sixMonthsAgo}
        GROUP BY to_char(date, 'YYYY-MM')
      `,
    ]);

    const totalRevenue = Number(revenueAgg._sum.paidAmount || 0);
    const totalExpenses = Number(expenseAgg._sum.amount || 0);
    const netIncome = totalRevenue - totalExpenses;

    const totalPresent = Number(attendanceRaw[0]?.totalPresent || 0);
    const totalRoster = Number(attendanceRaw[0]?.totalRoster || 0);
    const attendanceRate = totalRoster > 0 ? Math.round((totalPresent / totalRoster) * 1000) / 10 : 0;

    const academicAverage = scoreRaw[0]?.avgScore ? Math.round(Number(scoreRaw[0].avgScore) * 10) / 10 : 0;

    const recentAdmissions = recentStudents.map(s => ({
      id: s.id,
      name: s.user.name,
      avatar: s.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
      class: s.classSection?.class?.name && s.classSection?.section?.name
        ? `${s.classSection.class.name} - ${s.classSection.section.name}`
        : (s.classSection?.class?.name || 'Unassigned'),
      rollNo: s.rollNo || 'N/A',
      joiningDate: s.user.createdAt.toISOString().split('T')[0],
      status: 'Active',
    }));

    const studentPayments = invoices.map(inv => ({
      id: inv.id,
      type: 'Fee Payment',
      name: inv.student?.user?.name ? `${inv.student.user.name} - Tuition Fees` : 'Student Fee Payment',
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

    const invoicesByMonth = new Map((monthlyInvoicesRaw || []).map(r => [r.month, Number(r.totalPaid)]));
    const expensesByMonth = new Map((monthlyExpensesRaw || []).map(r => [r.month, Number(r.totalSalary)]));

    const chartData = last6Months.map(m => {
      const monthKey = `${m.year}-${String(m.month + 1).padStart(2, '0')}`;
      const collections = invoicesByMonth.get(monthKey) || 0;
      const salaries = expensesByMonth.get(monthKey) || 0;
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
      expiresAt: nowTime + 60 * 1000, // 60s cache with instant eviction on mutations
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
      successfulPaymentsCount,
      pendingPayments,
      totalStudents,
      totalTeachers,
      totalParents
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
      this.prisma.subscriptionPayment.findMany({
        where: { status: 'PENDING' },
        include: {
          tenant: { select: { id: true, name: true, subDomain: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentProfile.count(),
      this.prisma.staffProfile.count(),
      this.prisma.parentProfile.count(),
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
    const arr = totalRevenue > 0 ? Math.round(totalRevenue) : mrr * 12;

    const pendingRequests = pendingPayments.map((p) => {
      const resp = (p.gatewayResponse as any) || {};
      return {
        id: p.id,
        tenantId: p.tenantId,
        schoolName: p.tenant?.name || 'School',
        subDomain: p.tenant?.subDomain || '',
        plan: p.planId || 'BASIC',
        billingCycle: p.billingDurationMonths ? `${p.billingDurationMonths} Months` : '12 Months',
        billingMonths: p.billingDurationMonths || 12,
        amount: Number(p.amount),
        coupon: resp.couponCode || null,
        razorpayOrderId: p.gatewayReference || '',
        razorpayPaymentId: p.transactionId || '',
        transactionId: p.transactionId || '',
        paymentStatus: p.status,
        signatureVerified: p.signatureVerified,
        createdAt: p.createdAt,
      };
    });

    return {
      metrics: {
        totalRevenue,
        todayRevenue,
        monthlyRevenue,
        annualRevenue,
        mrr,
        arr,
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
        pendingApprovals: pendingRequests.length,
        totalStudents,
        totalTeachers,
        totalParents,
        totalEcosystemUsers: totalStudents + totalTeachers + totalParents,
        pendingRequests,
      },
    };
  }
}

