import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Role, Prisma } from '@prisma/client';
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

    // Dev-only timing — measure total service execution (remove before major release)
    const _t0 = process.env.NODE_ENV === 'development' ? Date.now() : 0;

    // Server-side in-memory cache (30s TTL, tenant-scoped key — never cross-tenant)
    // NOTE: In serverless/multi-instance deployments this Map is per-process only.
    // It helps warm requests on the same instance, not cold starts or other instances.
    const cacheKey = `dashboard-summary-${tenantId}`;
    const _cached = this.dashboardCache.get(cacheKey);
    if (_cached && _cached.expiresAt > Date.now()) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dashboard] CACHE HIT tenant=${tenantId} (${Date.now() - _t0}ms)`);
      }
      return _cached.data;
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

    // Execute unified database aggregations and targeted lookups concurrently
    // Dev-only timing: measure DB round-trip across all 7 parallel queries
    const _tDb = process.env.NODE_ENV === 'development' ? Date.now() : 0;
    const [
      metricsRaw,
      scoreRaw,
      recentStudents,
      invoices,
      salaryExpenses,
      monthlyInvoicesRaw,
      monthlyExpensesRaw
    ] = await Promise.all([
      // 1. Single Unified Query for primary counts, revenue, expenses, attendance & leave metrics
      this.prisma.$queryRaw<Array<any>>`
        SELECT
          (SELECT COUNT(*)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsCount",
          (SELECT COUNT(*)::int FROM "StaffProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true AND u.role::text IN ('TEACHER', 'STAFF')) AS "teachersCount",
          (SELECT COUNT(*)::int FROM "ClassSection" cs JOIN "Class" c ON cs."classId" = c.id WHERE cs."tenantId" = ${tenantId} AND c."isActive" = true) AS "classesCount",
          (SELECT COALESCE(SUM("paidAmount"), 0)::float FROM "Invoice" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "totalRevenue",
          (SELECT COALESCE(SUM(CASE WHEN "invoiceDate" >= ${thisMonthStart} THEN "paidAmount" ELSE 0 END), 0)::float FROM "Invoice" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "revThisMonth",
          (SELECT COALESCE(SUM(CASE WHEN "invoiceDate" >= ${lastMonthStart} AND "invoiceDate" <= ${lastMonthEnd} THEN "paidAmount" ELSE 0 END), 0)::float FROM "Invoice" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "revLastMonth",
          (SELECT COALESCE(SUM("amount"), 0)::float FROM "Expense" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID') AS "totalExpenses",
          (SELECT COALESCE(SUM("presentCount"), 0)::float FROM "AttendanceSession" WHERE "tenantId" = ${tenantId}) AS "totalPresent",
          (SELECT COALESCE(SUM("totalStudents"), 0)::float FROM "AttendanceSession" WHERE "tenantId" = ${tenantId}) AS "totalRoster",
          (SELECT COUNT(CASE WHEN status::text = 'PENDING' THEN 1 END)::int FROM "LeaveRequest" WHERE "tenantId" = ${tenantId}) AS "pendingLeaveRequests",
          (SELECT COUNT(CASE WHEN status::text = 'APPROVED' AND "approvedDate" >= ${todayStart} THEN 1 END)::int FROM "LeaveRequest" WHERE "tenantId" = ${tenantId}) AS "approvedToday",
          (SELECT COUNT(CASE WHEN status::text = 'REJECTED' AND "rejectedDate" >= ${todayStart} THEN 1 END)::int FROM "LeaveRequest" WHERE "tenantId" = ${tenantId}) AS "rejectedToday",
          (SELECT COUNT(CASE WHEN u."createdAt" >= ${thisMonthStart} THEN 1 END)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsThisMonth",
          (SELECT COUNT(CASE WHEN u."createdAt" >= ${lastMonthStart} AND u."createdAt" <= ${lastMonthEnd} THEN 1 END)::int FROM "StudentProfile" sp JOIN "User" u ON sp."userId" = u.id WHERE u."tenantId" = ${tenantId} AND u."isActive" = true) AS "studentsLastMonth"
      `.catch(() => [{}]),

      // 2. Avg. Academic Score
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
      `.catch(() => [{ avgScore: 0 }]),

      // 3. Recent Admissions (Targeted field selection, top 10)
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
      }).catch(() => []),

      // 4. Recent Payments - Invoices (Targeted field selection, top 10)
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: 'PAID',
        },
        select: {
          id: true,
          paidAmount: true,
          invoiceDate: true,
          description: true,
          student: {
            select: {
              rollNo: true,
              user: {
                select: {
                  name: true,
                },
              },
              classSection: {
                select: {
                  class: { select: { name: true } },
                  section: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: {
          invoiceDate: 'desc',
        },
        take: 10,
      }).catch(() => []),

      // 5. Recent Payments - Salary Expenses (Targeted field selection, top 10)
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
      }).catch(() => []),

      // 6. Monthly chart invoices aggregations in database (Last 6 months)
      this.prisma.$queryRaw<Array<{ month: string; totalPaid: number }>>`
        SELECT 
          to_char("invoiceDate", 'YYYY-MM') AS "month",
          COALESCE(SUM("paidAmount"), 0)::float AS "totalPaid"
        FROM "Invoice"
        WHERE "tenantId" = ${tenantId} 
          AND status::text = 'PAID' 
          AND "invoiceDate" >= ${sixMonthsAgo}
        GROUP BY to_char("invoiceDate", 'YYYY-MM')
      `.catch(() => []),

      // 7. Monthly chart salary expenses aggregations in database (Last 6 months)
      this.prisma.$queryRaw<Array<{ month: string; totalSalary: number }>>`
        SELECT 
          to_char(date, 'YYYY-MM') AS "month",
          COALESCE(SUM(amount), 0)::float AS "totalSalary"
        FROM "Expense"
        WHERE "tenantId" = ${tenantId} 
          AND category = 'Salary' 
          AND status::text = 'PAID' 
          AND date >= ${sixMonthsAgo}
        GROUP BY to_char(date, 'YYYY-MM')
      `.catch(() => []),
    ]);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Dashboard] DB Promise.all done in ${Date.now() - _tDb}ms (tenant=${tenantId})`);
    }

    const m = metricsRaw[0] || {};
    const studentsCount = Number(m.studentsCount || 0);
    const teachersCount = Number(m.teachersCount || 0);
    const classesCount = Number(m.classesCount || 0);
    const totalRevenue = Number(m.totalRevenue || 0);
    const revThisMonth = Number(m.revThisMonth || 0);
    const revLastMonth = Number(m.revLastMonth || 0);

    const totalExpenses = Number(m.totalExpenses || 0);
    const netIncome = totalRevenue - totalExpenses;

    const totalPresent = Number(m.totalPresent || 0);
    const totalRoster = Number(m.totalRoster || 0);
    const attendanceRate = totalRoster > 0 ? Math.round((totalPresent / totalRoster) * 1000) / 10 : 0;

    const academicAverage = scoreRaw[0]?.avgScore ? Math.round(Number(scoreRaw[0].avgScore) * 10) / 10 : 0;

    const pendingLeaveRequests = Number(m.pendingLeaveRequests || 0);
    const approvedToday = Number(m.approvedToday || 0);
    const rejectedToday = Number(m.rejectedToday || 0);

    const studentsThisMonth = Number(m.studentsThisMonth || 0);
    const studentsLastMonth = Number(m.studentsLastMonth || 0);

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

    const studentPayments = invoices.map(inv => {
      const studentName = inv.student?.user?.name || 'Student';
      const className = inv.student?.classSection?.class?.name
        ? `${inv.student.classSection.class.name}${inv.student.classSection.section?.name ? ` - ${inv.student.classSection.section.name}` : ''}`
        : '';
      const particulars = inv.description
        || (className ? `${studentName} (${className})` : `${studentName} - Fee Collection`);

      return {
        id: inv.id,
        type: 'Fee Payment',
        particulars,
        name: particulars,
        amount: Number(inv.paidAmount),
        date: inv.invoiceDate.toISOString().split('T')[0],
        status: 'Paid',
      };
    });

    const salaryPayments = salaryExpenses.map(exp => {
      const particulars = exp.description || 'Staff Salary Disbursement';
      return {
        id: exp.id,
        type: 'Salary Payment',
        particulars,
        name: particulars,
        amount: Number(exp.amount),
        date: exp.date.toISOString().split('T')[0],
        status: 'Paid',
      };
    });

    // Combine and sort by date descending
    const recentPayments = [...studentPayments, ...salaryPayments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    const invoicesByMonth = new Map((monthlyInvoicesRaw || []).map(r => [r.month, Number(r.totalPaid)]));
    const expensesByMonth = new Map((monthlyExpensesRaw || []).map(r => [r.month, Number(r.totalSalary)]));

    const chartData = last6Months.map(mon => {
      const monthKey = `${mon.year}-${String(mon.month + 1).padStart(2, '0')}`;
      const collections = invoicesByMonth.get(monthKey) || 0;
      const salaries = expensesByMonth.get(monthKey) || 0;
      return {
        month: mon.label,
        feeCollection: collections,
        salaryExpense: salaries,
        netRevenue: collections - salaries,
      };
    });

    const studentTrendVal = studentsLastMonth > 0 
      ? ((studentsThisMonth - studentsLastMonth) / studentsLastMonth) * 100
      : studentsThisMonth > 0 ? 100 : 0;

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

    // Store in server-side cache (tenant-scoped, 30s TTL)
    this.dashboardCache.set(cacheKey, { data: summaryData, expiresAt: Date.now() + 30000 });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Dashboard] CACHE MISS — built in ${Date.now() - _t0}ms (tenant=${tenantId})`);
    }

    return summaryData;
  }

  async getReportsSummary(userId?: string, role?: string) {
    const tenantId = this.getTenantId();

    let studentWhereSql = Prisma.sql`sp."tenantId" = ${tenantId} AND u."isActive" = true`;
    let marksWhereSql = Prisma.sql`em."tenantId" = ${tenantId}`;
    let showFinancials = true;

    if (this.roleFilterHelper.isTeacher(role)) {
      showFinancials = false;
      try {
        const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
        const classSectionIds = scope.assignedClassSectionIds;
        if (!classSectionIds || classSectionIds.length === 0) {
          studentWhereSql = Prisma.sql`1=0`;
          marksWhereSql = Prisma.sql`1=0`;
        } else {
          studentWhereSql = Prisma.sql`sp."tenantId" = ${tenantId} AND u."isActive" = true AND sp."classSectionId" IN (${Prisma.join(classSectionIds)})`;
          marksWhereSql = Prisma.sql`em."tenantId" = ${tenantId} AND sp."classSectionId" IN (${Prisma.join(classSectionIds)})`;
        }
      } catch {
        studentWhereSql = Prisma.sql`1=0`;
        marksWhereSql = Prisma.sql`1=0`;
      }
    }

    // Run parallel SQL queries
    const [classRows, timelineRows, finRows, markRows, examSubjects] = await Promise.all([
      // 1. Enrollment Demographics (Student counts grouped by class)
      this.prisma.$queryRaw<any[]>`
        SELECT
          COALESCE(c.name, 'Unassigned') AS "className",
          COUNT(*)::int AS "count"
        FROM "StudentProfile" sp
        INNER JOIN "User" u ON sp."userId" = u.id
        LEFT JOIN "ClassSection" cs ON sp."classSectionId" = cs.id
        LEFT JOIN "Class" c ON cs."classId" = c.id
        WHERE ${studentWhereSql}
        GROUP BY c.name
      `,
      // 2. Timeline groups
      this.prisma.$queryRaw<any[]>`
        SELECT
          TO_CHAR(u."createdAt", 'YYYY-MM') AS "date",
          COUNT(*)::int AS "count"
        FROM "StudentProfile" sp
        INNER JOIN "User" u ON sp."userId" = u.id
        WHERE ${studentWhereSql}
        GROUP BY TO_CHAR(u."createdAt", 'YYYY-MM')
        ORDER BY "date" ASC
      `,
      // 3. Financial Statements
      showFinancials
        ? this.prisma.$queryRaw<any[]>`
            SELECT
              (SELECT COALESCE(SUM("paidAmount"), 0) FROM "Invoice" WHERE "tenantId" = ${tenantId})::float AS "totalRevenue",
              (SELECT COALESCE(SUM("remainingBalance"), 0) FROM "Invoice" WHERE "tenantId" = ${tenantId})::float AS "outstandingReceivables",
              (SELECT COALESCE(SUM("amount"), 0) FROM "Expense" WHERE "tenantId" = ${tenantId} AND status::text = 'PAID')::float AS "totalExpenses"
          `
        : Promise.resolve([]),
      // 4. Exam marks for grading summary
      this.prisma.$queryRaw<any[]>`
        SELECT
          em."examId",
          em."subjectId",
          em."subjectType"::text AS "subjectType",
          em."marksObtained"::float AS "marksObtained"
        FROM "ExamMark" em
        INNER JOIN "StudentProfile" sp ON em."studentId" = sp.id
        WHERE ${marksWhereSql}
      `,
      // 5. ExamSubjects config
      this.prisma.examSubject.findMany({
        where: { tenantId },
        select: { examId: true, subjectId: true, subjectType: true, maxMarks: true, passingPercentage: true },
      }),
    ]);

    const classDistribution: Record<string, number> = {};
    let totalStudents = 0;
    classRows.forEach(r => {
      classDistribution[r.className] = Number(r.count);
      totalStudents += Number(r.count);
    });

    const timeline = timelineRows.map(r => ({
      date: r.date,
      count: Number(r.count),
    }));

    const demographics = {
      totalStudents,
      classDistribution,
      timeline,
    };

    let financials = {
      totalRevenue: 0,
      outstandingReceivables: 0,
      totalExpenses: 0,
      netCashflow: 0,
    };

    if (showFinancials && finRows.length > 0) {
      const totalRevenue = Number(finRows[0].totalRevenue || 0);
      const outstandingReceivables = Number(finRows[0].outstandingReceivables || 0);
      const totalExpenses = Number(finRows[0].totalExpenses || 0);
      financials = {
        totalRevenue,
        outstandingReceivables,
        totalExpenses,
        netCashflow: totalRevenue - totalExpenses,
      };
    }

    const subjectConfigMap = new Map(
      examSubjects.map(es => [`${es.examId}_${es.subjectId}_${es.subjectType}`, es]),
    );

    let totalPctScore = 0;
    let passedCount = 0;
    const distribution = {
      failed: 0, // < 35
      belowAverage: 0, // 35 - 60
      average: 0, // 60 - 75
      firstDivision: 0, // 75 - 90
      highDistinction: 0, // 90 - 100
    };

    markRows.forEach(m => {
      const score = Number(m.marksObtained);
      const es = subjectConfigMap.get(`${m.examId}_${m.subjectId}_${m.subjectType}`);
      const maxMarks = es ? es.maxMarks : 100;
      const passingPct = es ? Number(es.passingPercentage) : 35;

      const pct = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
      totalPctScore += pct;

      if (pct < passingPct) {
        distribution.failed++;
      } else {
        passedCount++;
        if (pct >= passingPct && pct < 60) distribution.belowAverage++;
        else if (pct >= 60 && pct < 75) distribution.average++;
        else if (pct >= 75 && pct < 90) distribution.firstDivision++;
        else if (pct >= 90) distribution.highDistinction++;
      }
    });

    const totalMarksEntries = markRows.length;
    const averageScore = totalMarksEntries > 0 ? totalPctScore / totalMarksEntries : 0;
    const passRate = totalMarksEntries > 0 ? (passedCount / totalMarksEntries) * 100 : 0;

    const grading = {
      averageScore: Math.round(averageScore * 10) / 10,
      passRate: Math.round(passRate * 10) / 10,
      distribution,
    };

    return {
      demographics,
      financials,
      grading,
    };
  }

  async getDemographicsReport(userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    let studentWhereSql = Prisma.sql`sp."tenantId" = ${tenantId} AND u."isActive" = true`;

    if (this.roleFilterHelper.isTeacher(role)) {
      try {
        const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
        const classSectionIds = scope.assignedClassSectionIds;
        if (!classSectionIds || classSectionIds.length === 0) {
          studentWhereSql = Prisma.sql`1=0`;
        } else {
          studentWhereSql = Prisma.sql`sp."tenantId" = ${tenantId} AND u."isActive" = true AND sp."classSectionId" IN (${Prisma.join(classSectionIds)})`;
        }
      } catch {
        studentWhereSql = Prisma.sql`1=0`;
      }
    }

    const students = await this.prisma.$queryRaw<any[]>`
      SELECT
        u.name AS "name",
        COALESCE(u.email, 'N/A') AS "email",
        COALESCE(u.phone, 'N/A') AS "phone",
        COALESCE(c.name, 'Unassigned') AS "class",
        COALESCE(sec.name, 'Unassigned') AS "section",
        COALESCE(sp."rollNo", 'N/A') AS "rollNo",
        TO_CHAR(u."createdAt", 'YYYY-MM-DD') AS "joiningDate"
      FROM "StudentProfile" sp
      INNER JOIN "User" u ON sp."userId" = u.id
      LEFT JOIN "ClassSection" cs ON sp."classSectionId" = cs.id
      LEFT JOIN "Class" c ON cs."classId" = c.id
      LEFT JOIN "Section" sec ON cs."sectionId" = sec.id
      WHERE ${studentWhereSql}
      ORDER BY sp.id ASC
    `;

    return students.map(s => ({
      name: s.name,
      email: s.email,
      phone: s.phone,
      class: s.class,
      section: s.section,
      rollNo: s.rollNo,
      joiningDate: s.joiningDate,
    }));
  }

  async getCashflowsReport(userId?: string, role?: string) {
    // Teachers should not see cashflows
    if (role === Role.TEACHER) {
      return [];
    }

    const tenantId = this.getTenantId();
    const [invoiceRows, expenseRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT
          i.id,
          u.name AS "studentName",
          i."paidAmount"::float AS "paidAmount",
          i."remainingBalance"::float AS "remainingBalance",
          TO_CHAR(i."invoiceDate", 'YYYY-MM-DD') AS "invoiceDate",
          TO_CHAR(i."dueDate", 'YYYY-MM-DD') AS "dueDate",
          i.status::text AS "status"
        FROM "Invoice" i
        LEFT JOIN "StudentProfile" sp ON i."studentId" = sp.id
        LEFT JOIN "User" u ON sp."userId" = u.id
        WHERE i."tenantId" = ${tenantId}
        ORDER BY i.id ASC
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT
          e.id,
          COALESCE(e.description, e.category, 'Vendor Payment') AS "name",
          e.amount::float AS "amount",
          TO_CHAR(e.date, 'YYYY-MM-DD') AS "date",
          e.status::text AS "status"
        FROM "Expense" e
        WHERE e."tenantId" = ${tenantId} AND e.status::text = 'PAID'
        ORDER BY e.id ASC
      `,
    ]);

    const txs: any[] = [];
    invoiceRows.forEach(inv => {
      txs.push({
        type: 'Fee Revenue',
        name: inv.studentName || 'Student Fee',
        amount: Number(inv.paidAmount),
        date: inv.invoiceDate,
        status: inv.status,
      });
      if (Number(inv.remainingBalance) > 0) {
        txs.push({
          type: 'Receivable Outstanding',
          name: inv.studentName || 'Student Fee',
          amount: Number(inv.remainingBalance),
          date: inv.dueDate,
          status: 'UNPAID',
        });
      }
    });

    expenseRows.forEach(exp => {
      txs.push({
        type: 'School Expense',
        name: exp.name,
        amount: -Number(exp.amount),
        date: exp.date,
        status: 'PAID',
      });
    });

    return txs;
  }

  async getGradingReport(userId?: string, role?: string) {
    const tenantId = this.getTenantId();
    let marksWhereSql = Prisma.sql`em."tenantId" = ${tenantId}`;

    if (this.roleFilterHelper.isTeacher(role)) {
      try {
        const scope = await this.roleFilterHelper.buildTeacherScope(userId, tenantId);
        const classSectionIds = scope.assignedClassSectionIds;
        if (!classSectionIds || classSectionIds.length === 0) {
          marksWhereSql = Prisma.sql`1=0`;
        } else {
          marksWhereSql = Prisma.sql`em."tenantId" = ${tenantId} AND sp."classSectionId" IN (${Prisma.join(classSectionIds)})`;
        }
      } catch {
        marksWhereSql = Prisma.sql`1=0`;
      }
    }

    const [marks, examSubjects] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT
          em.id,
          em."examId",
          em."subjectId",
          em."subjectType"::text AS "subjectType",
          em."marksObtained"::float AS "marksObtained",
          COALESCE(u.name, 'Student') AS "studentName",
          COALESCE(sp."rollNo", 'N/A') AS "rollNo",
          COALESCE(sub.name, 'Subject') AS "subjectName",
          COALESCE(e.type, 'Exam') AS "examType"
        FROM "ExamMark" em
        LEFT JOIN "StudentProfile" sp ON em."studentId" = sp.id
        LEFT JOIN "User" u ON sp."userId" = u.id
        LEFT JOIN "Subject" sub ON em."subjectId" = sub.id
        LEFT JOIN "Exam" e ON em."examId" = e.id
        WHERE ${marksWhereSql}
        ORDER BY em.id ASC
      `,
      this.prisma.examSubject.findMany({
        where: { tenantId },
        select: { examId: true, subjectId: true, subjectType: true, maxMarks: true },
      }),
    ]);

    const subjectConfigMap = new Map(
      examSubjects.map(es => [`${es.examId}_${es.subjectId}_${es.subjectType}`, es]),
    );

    return marks.map(m => {
      const es = subjectConfigMap.get(`${m.examId}_${m.subjectId}_${m.subjectType}`);
      const maxMarks = es ? es.maxMarks : 100;

      return {
        studentName: m.studentName,
        rollNo: m.rollNo,
        subject: m.subjectName,
        subjectType: m.subjectType,
        examType: m.examType,
        marksObtained: Number(m.marksObtained),
        maxMarks: maxMarks,
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

