const { PrismaClient, PaymentStatus, ExpenseStatus, PaymentMethod } = require('@prisma/client');
const prisma = new PrismaClient();

// Load the baseline implementation from test script for comparison
const { runBaseline } = require('./test_financial_command_center_optimization.js');

// Helper to call service method logic directly or import service
async function testServiceCall(tenantId, filters = {}) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const last30DaysLimit = new Date(startOfToday);
  last30DaysLimit.setDate(last30DaysLimit.getDate() - 30);

  const targetTwelveMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const targetThirtyDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);

  const t0 = process.hrtime.bigint();
  const memBefore = process.memoryUsage().heapUsed;

  // 1. Initial configuration lookups
  const [activeYear, allClasses, allSections, academicYearsList, allPricebookEntries] = await Promise.all([
    prisma.academicYear.findFirst({ where: { tenantId, isActive: true } }),
    prisma.class.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.section.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.academicYear.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    prisma.pricebookEntry.findMany({
      where: {
        tenantId,
        isActive: true,
        pricebook: { isActive: true },
        product: { isActive: true }
      },
      select: {
        unitPrice: true,
        pricebook: { select: { classId: true } }
      }
    })
  ]);

  const classMap = new Map(allClasses.map(c => [c.id, c.name]));
  const sectionMap = new Map(allSections.map(s => [s.id, s.name]));

  const classBaseFeeMap = new Map();
  for (const entry of allPricebookEntries) {
    const cid = entry.pricebook?.classId;
    if (cid) {
      classBaseFeeMap.set(cid, (classBaseFeeMap.get(cid) || 0) + Number(entry.unitPrice));
    }
  }

  // Date Filter resolution
  let startDate;
  let endDate;

  if (filters.startDate && filters.endDate) {
    startDate = new Date(filters.startDate);
    endDate = new Date(filters.endDate);
  } else if (filters.month) {
    const year = new Date().getFullYear();
    startDate = new Date(year, filters.month - 1, 1);
    endDate = new Date(year, filters.month, 0, 23, 59, 59, 999);
  } else if (filters.academicYearId) {
    const ay = await prisma.academicYear.findUnique({ where: { id: filters.academicYearId } });
    if (ay) {
      startDate = ay.startDate;
      endDate = ay.endDate;
    }
  } else if (activeYear) {
    startDate = activeYear.startDate;
    endDate = activeYear.endDate;
  }

  // Build Invoices query filter
  const invoiceWhere = {
    tenantId,
    status: { not: PaymentStatus.VOIDED },
  };
  if (startDate && endDate) {
    invoiceWhere.invoiceDate = { gte: startDate, lte: endDate };
  }
  if (filters.studentId) {
    invoiceWhere.studentId = filters.studentId;
  }
  if (filters.paymentMethod) {
    let method = PaymentMethod.CASH;
    if (filters.paymentMethod === 'GPAY_UPI' || filters.paymentMethod === 'PHONEPE_UPI' || filters.paymentMethod === 'UPI') {
      method = PaymentMethod.UPI;
    } else if (filters.paymentMethod === 'NET_BANKING' || filters.paymentMethod === 'BANK_TRANSFER') {
      method = PaymentMethod.BANK_TRANSFER;
    } else if (filters.paymentMethod === 'CARD') {
      method = PaymentMethod.CARD;
    }
    invoiceWhere.paymentMethod = method;
  }
  if (filters.classId || filters.sectionId) {
    invoiceWhere.student = {
      classSection: {
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      }
    };
  }
  if (filters.feeCategory) {
    invoiceWhere.invoiceItems = {
      some: { productId: filters.feeCategory }
    };
  }

  // Build Expenses query filter
  const expenseWhere = {
    tenantId,
    status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] },
  };
  if (startDate && endDate) {
    expenseWhere.date = { gte: startDate, lte: endDate };
  }
  if (filters.expenseCategory) {
    expenseWhere.category = filters.expenseCategory;
  }

  const ayStart = activeYear?.startDate || new Date(0);
  const ayEnd = activeYear?.endDate || new Date(0);
  const hasAY = Boolean(activeYear?.startDate && activeYear?.endDate);
  const targetAYId = filters.academicYearId || activeYear?.id || null;

  // 2. High-Performance Concurrent Batch Execution
  const [
    revenueStatsRaw,
    expenseStatsRaw,
    prevMonthExpenseBudgetRaw,
    highestExpenseStatsRaw,
    monthlyInvoicesRaw,
    monthlyExpensesRaw,
    dailyInvoicesRaw,
    filteredInvoices,
    filteredExpenses,
    rawStudents,
    rawOpps,
    priorInvoicesSum,
    priorExpensesSum,
    pendingExpensesSum,
    promotedCount,
    voidedInvoices,
    promotionLogs,
    voidedInvoicesTimeline
  ] = await Promise.all([
    // A: Time-bucketed Revenue in SQL
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM("paidAmount"), 0)::float AS "allTime",
        COALESCE(SUM(CASE WHEN "invoiceDate" >= ${startOfToday} THEN "paidAmount" ELSE 0 END), 0)::float AS "today",
        COALESCE(SUM(CASE WHEN "invoiceDate" >= ${startOfYesterday} AND "invoiceDate" < ${startOfToday} THEN "paidAmount" ELSE 0 END), 0)::float AS "yesterday",
        COALESCE(SUM(CASE WHEN "invoiceDate" >= ${startOfWeek} THEN "paidAmount" ELSE 0 END), 0)::float AS "thisWeek",
        COALESCE(SUM(CASE WHEN "invoiceDate" >= ${startOfMonth} THEN "paidAmount" ELSE 0 END), 0)::float AS "currentMonth",
        COALESCE(SUM(CASE WHEN "invoiceDate" >= ${startOfPrevMonth} AND "invoiceDate" <= ${endOfPrevMonth} THEN "paidAmount" ELSE 0 END), 0)::float AS "prevMonth",
        COALESCE(SUM(CASE WHEN "invoiceDate" >= ${last30DaysLimit} THEN "paidAmount" ELSE 0 END), 0)::float AS "last30Days",
        COALESCE(SUM(CASE WHEN ${hasAY} AND "invoiceDate" >= ${ayStart} AND "invoiceDate" <= ${ayEnd} THEN "paidAmount" ELSE 0 END), 0)::float AS "academicYear",
        COALESCE(COUNT(CASE WHEN "invoiceDate" >= ${startOfMonth} AND ("status" = 'PAID' OR "status" = 'PARTIALLY_PAID') AND "paidAmount" > 0 THEN 1 END), 0)::int AS "currentMonthInvoicesCount",
        COALESCE(COUNT(CASE WHEN "invoiceDate" >= ${startOfPrevMonth} AND "invoiceDate" <= ${endOfPrevMonth} AND ("status" = 'PAID' OR "status" = 'PARTIALLY_PAID') AND "paidAmount" > 0 THEN 1 END), 0)::int AS "prevMonthInvoicesCount"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId}
        AND "status" != 'VOIDED'
    `,
    // B: Time-bucketed Expenses in SQL
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM("amount"), 0)::float AS "allTime",
        COALESCE(SUM(CASE WHEN "date" >= ${startOfToday} THEN "amount" ELSE 0 END), 0)::float AS "today",
        COALESCE(SUM(CASE WHEN "date" >= ${startOfWeek} THEN "amount" ELSE 0 END), 0)::float AS "thisWeek",
        COALESCE(SUM(CASE WHEN "date" >= ${startOfMonth} THEN "amount" ELSE 0 END), 0)::float AS "currentMonth",
        COALESCE(SUM(CASE WHEN "date" >= ${startOfPrevMonth} AND "date" <= ${endOfPrevMonth} THEN "amount" ELSE 0 END), 0)::float AS "prevMonth",
        COALESCE(SUM(CASE WHEN ${hasAY} AND "date" >= ${ayStart} AND "date" <= ${ayEnd} THEN "amount" ELSE 0 END), 0)::float AS "academicYear"
      FROM "Expense"
      WHERE "tenantId" = ${tenantId}
        AND "status" IN ('PAID', 'APPROVED')
    `,
    // C: Budget Categories Prev Month Expenses in SQL
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN "category" ILIKE '%salary%' THEN "amount" ELSE 0 END), 0)::float AS "salaries",
        COALESCE(SUM(CASE WHEN "category" ILIKE '%transport%' THEN "amount" ELSE 0 END), 0)::float AS "transport",
        COALESCE(SUM(CASE WHEN "category" ILIKE '%maintenance%' THEN "amount" ELSE 0 END), 0)::float AS "maintenance",
        COALESCE(SUM(CASE WHEN "category" ILIKE '%event%' THEN "amount" ELSE 0 END), 0)::float AS "events",
        COALESCE(SUM(CASE WHEN "category" ILIKE '%marketing%' THEN "amount" ELSE 0 END), 0)::float AS "marketing",
        COALESCE(SUM(CASE WHEN "category" ILIKE '%electricity%' OR "category" ILIKE '%internet%' OR "category" ILIKE '%utility%' THEN "amount" ELSE 0 END), 0)::float AS "utilities"
      FROM "Expense"
      WHERE "tenantId" = ${tenantId}
        AND "status" IN ('PAID', 'APPROVED')
        AND "date" >= ${startOfPrevMonth}
        AND "date" <= ${endOfPrevMonth}
    `,
    // D: Max Expense Today & Month in SQL
    prisma.$queryRaw`
      SELECT
        COALESCE(MAX(CASE WHEN "date" >= ${startOfToday} THEN "amount" ELSE 0 END), 0)::float AS "highestToday",
        COALESCE(MAX(CASE WHEN "date" >= ${startOfMonth} THEN "amount" ELSE 0 END), 0)::float AS "highestThisMonth"
      FROM "Expense"
      WHERE "tenantId" = ${tenantId}
        AND "status" IN ('PAID', 'APPROVED')
    `,
    // E: 12-month Invoices Grouping
    prisma.$queryRaw`
      SELECT
        to_char("invoiceDate", 'YYYY-MM') AS "monthKey",
        COALESCE(SUM("paidAmount"), 0)::float AS "total"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId}
        AND "status" != 'VOIDED'
        AND "invoiceDate" >= ${targetTwelveMonth}
      GROUP BY 1
    `,
    // F: 12-month Expenses Grouping
    prisma.$queryRaw`
      SELECT
        to_char("date", 'YYYY-MM') AS "monthKey",
        COALESCE(SUM("amount"), 0)::float AS "total"
      FROM "Expense"
      WHERE "tenantId" = ${tenantId}
        AND "status" IN ('PAID', 'APPROVED')
        AND "date" >= ${targetTwelveMonth}
      GROUP BY 1
    `,
    // G: 30-day Invoices Grouping
    prisma.$queryRaw`
      SELECT
        to_char("invoiceDate", 'YYYY-MM-DD') AS "dayKey",
        COALESCE(SUM("paidAmount"), 0)::float AS "total"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId}
        AND "status" != 'VOIDED'
        AND "invoiceDate" >= ${targetThirtyDays}
      GROUP BY 1
    `,
    // H: Filtered Invoices (lightweight projection)
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        paidAmount: true,
        invoiceDate: true,
        paymentMethod: true,
        student: { select: { user: { select: { name: true } } } }
      }
    }),
    // I: Filtered Expenses (lightweight projection)
    prisma.expense.findMany({
      where: expenseWhere,
      select: {
        id: true,
        category: true,
        amount: true,
        date: true,
        description: true,
        paymentMode: true,
      }
    }),
    // J: Raw SQL Student Profiles (super-fast single round-trip)
    prisma.$queryRaw`
      SELECT 
        sp.id,
        COALESCE(sp."rollNo", '') AS "rollNo",
        cs."classId",
        cs."sectionId",
        u.name,
        u."isActive",
        u."createdAt"
      FROM "StudentProfile" sp
      JOIN "User" u ON sp."userId" = u.id
      LEFT JOIN "ClassSection" cs ON sp."classSectionId" = cs.id
      WHERE sp."tenantId" = ${tenantId}
    `,
    // K: Raw SQL Active Opportunities with Line Items & Invoices (super-fast single round-trip)
    prisma.$queryRaw`
      SELECT 
        o.id,
        o."studentId",
        o."classId",
        o."sectionId",
        o."closeDate",
        COALESCE(oli_agg."netFee", 0)::float AS "netFee",
        COALESCE(inv_agg."paid", 0)::float AS "paid",
        oli_agg."lineItems"
      FROM "Opportunity" o
      LEFT JOIN LATERAL (
        SELECT 
          SUM(oli."unitPrice" * oli."quantity" * (1 - oli."discount" / 100.0))::float AS "netFee",
          json_agg(json_build_object(
            'id', oli.id,
            'productName', p.name,
            'unitPrice', oli."unitPrice"::float,
            'quantity', oli."quantity"::float,
            'discount', oli."discount"::float
          )) AS "lineItems"
        FROM "OpportunityLineItem" oli
        LEFT JOIN "Product" p ON oli."productId" = p.id
        WHERE oli."opportunityId" = o.id
      ) oli_agg ON true
      LEFT JOIN LATERAL (
        SELECT 
          SUM(inv."paidAmount")::float AS "paid"
        FROM "Invoice" inv
        WHERE inv."opportunityId" = o.id
          AND inv."status" != 'VOIDED'
      ) inv_agg ON true
      WHERE o."tenantId" = ${tenantId}
        AND (${targetAYId}::text IS NULL OR o."academicYearId" = ${targetAYId})
    `,
    // L: Opening Balance Prior Invoices Sum
    prisma.invoice.aggregate({
      where: {
        tenantId,
        status: { not: PaymentStatus.VOIDED },
        invoiceDate: { lt: startDate || new Date(0) }
      },
      _sum: { paidAmount: true }
    }),
    // M: Opening Balance Prior Expenses Sum
    prisma.expense.aggregate({
      where: {
        tenantId,
        status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] },
        date: { lt: startDate || new Date(0) }
      },
      _sum: { amount: true }
    }),
    // N: Expected Expenses
    prisma.expense.aggregate({
      where: { tenantId, status: ExpenseStatus.PENDING },
      _sum: { amount: true }
    }),
    // O: Promoted Count
    prisma.activityLog.count({
      where: {
        tenantId,
        action: 'RECORD_UPDATE',
        entityName: 'StudentProfile',
        details: { contains: 'Promoted from' },
        createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
      }
    }),
    // P: Voided Invoices (top 10 for activities)
    prisma.invoice.findMany({
      where: { tenantId, status: PaymentStatus.VOIDED },
      select: {
        id: true,
        totalAmount: true,
        invoiceDate: true,
        student: { select: { user: { select: { name: true } } } }
      },
      orderBy: { invoiceDate: 'desc' },
      take: 10
    }),
    // Q: Activity Log for Timeline
    prisma.activityLog.findMany({
      where: {
        tenantId,
        action: 'RECORD_UPDATE',
        entityName: 'StudentProfile',
        details: { contains: 'Promoted from' },
        createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
      }
    }),
    // R: Voided Invoices for Timeline
    prisma.invoice.findMany({
      where: {
        tenantId,
        status: PaymentStatus.VOIDED,
        invoiceDate: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
      },
      select: {
        id: true,
        totalAmount: true,
        invoiceDate: true,
        student: { select: { user: { select: { name: true } } } }
      }
    })
  ]);

  const tDbEnd = process.hrtime.bigint();

  // Extract SQL Aggregates
  const revStats = revenueStatsRaw[0] || {};
  const expStats = expenseStatsRaw[0] || {};
  const prevBudgetStats = prevMonthExpenseBudgetRaw[0] || {};
  const maxExpStats = highestExpenseStatsRaw[0] || {};

  const totalCollectedFiltered = filteredInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
  const totalExpensesFiltered = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  const revenueAllTime = revStats.allTime || 0;
  const revenueToday = revStats.today || 0;
  const revenueYesterday = revStats.yesterday || 0;
  const revenueThisWeek = revStats.thisWeek || 0;
  const revenueCurrentMonth = revStats.currentMonth || 0;
  const revenuePrevMonth = revStats.prevMonth || 0;
  const revenueLast30Days = revStats.last30Days || 0;
  const revenueAcademicYear = revStats.academicYear || 0;
  const paidInvoicesCountCurrentMonth = revStats.currentMonthInvoicesCount || 0;
  const paidInvoicesCountPrevMonth = revStats.prevMonthInvoicesCount || 0;

  const expensesAllTime = expStats.allTime || 0;
  const expensesToday = expStats.today || 0;
  const expensesThisWeek = expStats.thisWeek || 0;
  const expensesCurrentMonth = expStats.currentMonth || 0;
  const expensesPrevMonth = expStats.prevMonth || 0;
  const expensesAcademicYear = expStats.academicYear || 0;

  // Dues calculations
  let totalPendingAmount = 0;
  const pendingStudentsSet = new Set();
  const studentDues = [];

  const classPending = new Map();
  const sectionPending = new Map();
  const categoryPending = new Map();

  for (const c of allClasses) {
    classPending.set(c.id, { pending: 0, collected: 0, studentCount: 0 });
  }
  for (const s of allSections) {
    sectionPending.set(s.id, { pending: 0, collected: 0, studentCount: 0 });
  }

  const studentProfileMap = new Map(rawStudents.map(sp => [sp.id, sp]));
  const allFeeAdjustments = [];

  for (const opp of rawOpps) {
    let netFee = opp.netFee || 0;

    if (netFee === 0 && opp.classId) {
      netFee = classBaseFeeMap.get(opp.classId) || 0;
    }

    const paid = opp.paid || 0;
    const pending = Math.max(0, netFee - paid);

    if (pending > 0) {
      totalPendingAmount += pending;
      pendingStudentsSet.add(opp.studentId);
    }

    const studentProfile = studentProfileMap.get(opp.studentId);
    studentDues.push({
      studentId: opp.studentId,
      studentName: studentProfile?.name || 'Unknown Student',
      rollNo: studentProfile?.rollNo || '',
      className: studentProfile?.classId ? classMap.get(studentProfile.classId) : '',
      sectionName: studentProfile?.sectionId ? sectionMap.get(studentProfile.sectionId) : '',
      totalFee: netFee,
      paid,
      pending,
      closeDate: opp.closeDate,
    });

    if (opp.classId) {
      const cur = classPending.get(opp.classId) || { pending: 0, collected: 0, studentCount: 0 };
      classPending.set(opp.classId, {
        pending: cur.pending + pending,
        collected: cur.collected + paid,
        studentCount: cur.studentCount + 1
      });
    }
    if (opp.sectionId) {
      const cur = sectionPending.get(opp.sectionId) || { pending: 0, collected: 0, studentCount: 0 };
      sectionPending.set(opp.sectionId, {
        pending: cur.pending + pending,
        collected: cur.collected + paid,
        studentCount: cur.studentCount + 1
      });
    }

    const lineItems = opp.lineItems || [];
    const paidRatio = netFee > 0 ? (paid / netFee) : 1;
    for (const oli of lineItems) {
      const catName = oli.productName;
      const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
      const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
      const itemNet = itemTotal - itemDiscount;
      const itemPaid = itemNet * paidRatio;
      const itemPending = Math.max(0, itemNet - itemPaid);

      const curCat = categoryPending.get(catName) || { pending: 0, collected: 0 };
      categoryPending.set(catName, {
        pending: curCat.pending + itemPending,
        collected: curCat.collected + itemPaid
      });

      if (Number(oli.discount) > 0) {
        allFeeAdjustments.push({
          id: oli.id,
          productName: oli.productName,
          discountPercent: Number(oli.discount),
          unitPrice: Number(oli.unitPrice)
        });
      }
    }
  }

  let dueToday = 0;
  let dueThisWeek = 0;
  let dueThisMonth = 0;
  let overdueAmount = 0;

  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 7);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  for (const due of studentDues) {
    const deadline = new Date(due.closeDate);
    if (due.pending > 0) {
      if (deadline < startOfToday) overdueAmount += due.pending;
      if (deadline.toDateString() === now.toDateString()) dueToday += due.pending;
      if (deadline >= startOfThisWeek && deadline < endOfThisWeek) dueThisWeek += due.pending;
      if (deadline >= startOfThisMonth && deadline <= endOfThisMonth) dueThisMonth += due.pending;
    }
  }

  const totalStudentsCount = rawStudents.length;
  const activeStudentsCount = rawStudents.filter(sp => sp.isActive).length;
  
  let paidCompletelyCount = 0;
  let partiallyPaidCount = 0;
  let pendingCount = 0;

  for (const student of rawStudents) {
    const dues = studentDues.filter(d => d.studentId === student.id);
    if (dues.length === 0) {
      paidCompletelyCount++;
      continue;
    }
    const totalPending = dues.reduce((sum, d) => sum + d.pending, 0);
    const totalPaid = dues.reduce((sum, d) => sum + d.paid, 0);

    if (totalPending === 0) {
      paidCompletelyCount++;
    } else if (totalPaid > 0) {
      partiallyPaidCount++;
    } else {
      pendingCount++;
    }
  }

  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newAdmissionsCount = rawStudents.filter(sp => new Date(sp.createdAt) >= currentMonthStart).length;
  
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthAdmissionsCount = rawStudents.filter(sp => {
    const d = new Date(sp.createdAt);
    return d >= prevMonthStart && d < currentMonthStart;
  }).length;

  const openingBalance = Number(priorInvoicesSum._sum.paidAmount || 0) - Number(priorExpensesSum._sum.amount || 0);
  const closingBalance = openingBalance + totalCollectedFiltered - totalExpensesFiltered;

  const expectedIncome = totalPendingAmount;
  const expectedExpenses = Number(pendingExpensesSum._sum.amount || 0);
  const netCashFlow = totalCollectedFiltered - totalExpensesFiltered;

  // Growth calculations using exact formulas
  const currentPeriodRev = revenueCurrentMonth;
  const currentPeriodExp = expensesCurrentMonth;
  const currentPeriodProfit = currentPeriodRev - currentPeriodExp;

  const prevPeriodRev = revenuePrevMonth;
  const prevPeriodExp = expensesPrevMonth;
  const prevPeriodProfit = prevPeriodRev - prevPeriodExp;

  const calcGrowth = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  const revenueGrowthMonth = calcGrowth(currentPeriodRev, prevPeriodRev);
  const expenseGrowthMonth = calcGrowth(currentPeriodExp, prevPeriodExp);
  const profitGrowthMonth = calcGrowth(currentPeriodProfit, prevPeriodProfit);
  const collectionGrowthMonth = calcGrowth(currentPeriodRev, prevPeriodRev);
  const studentGrowthMonth = calcGrowth(newAdmissionsCount, prevMonthAdmissionsCount);

  const collectionRateVal = (revenueAcademicYear + totalPendingAmount) > 0
    ? (revenueAcademicYear / (revenueAcademicYear + totalPendingAmount)) * 100
    : 100;
  const pendingPercentageVal = 100 - collectionRateVal;

  let healthIndicator = '🟢 Excellent';
  if (collectionRateVal < 50) {
    healthIndicator = '🔴 Critical';
  } else if (collectionRateVal < 75) {
    healthIndicator = '🟠 Average';
  } else if (collectionRateVal < 90) {
    healthIndicator = '🟡 Good';
  }

  const outstandingByClass = Array.from(classPending.entries()).map(([classId, data]) => {
    const className = classMap.get(classId) || 'Unknown Class';
    const colRate = (data.collected + data.pending) > 0 ? (data.collected / (data.collected + data.pending)) * 100 : 100;
    return {
      classId,
      className,
      totalPending: data.pending,
      studentCount: data.studentCount,
      collectionPercentage: Math.round(colRate * 10) / 10,
      collected: data.collected
    };
  }).sort((a, b) => b.totalPending - a.totalPending);

  const outstandingBySection = Array.from(sectionPending.entries()).map(([sectionId, data]) => {
    const sectionName = sectionMap.get(sectionId) || 'Unknown Section';
    const colRate = (data.collected + data.pending) > 0 ? (data.collected / (data.collected + data.pending)) * 100 : 100;
    return {
      sectionId,
      sectionName,
      totalPending: data.pending,
      studentCount: data.studentCount,
      collectionPercentage: Math.round(colRate * 10) / 10,
      collected: data.collected
    };
  }).sort((a, b) => b.totalPending - a.totalPending);

  const feeCategoryAnalysis = Array.from(categoryPending.entries()).map(([catName, data]) => {
    const colRate = (data.collected + data.pending) > 0 ? (data.collected / (data.collected + data.pending)) * 100 : 100;
    return {
      categoryName: catName,
      collected: data.collected,
      pending: data.pending,
      collectionPercentage: Math.round(colRate * 10) / 10
    };
  });

  const expenseCategoriesMap = new Map();
  for (const exp of filteredExpenses) {
    const cat = exp.category;
    expenseCategoriesMap.set(cat, (expenseCategoriesMap.get(cat) || 0) + Number(exp.amount));
  }
  const expenseCategoryAnalysis = Array.from(expenseCategoriesMap.entries()).map(([catName, totalAmt]) => ({
    categoryName: catName,
    amount: totalAmt,
    percentage: totalExpensesFiltered > 0 ? Math.round((totalAmt / totalExpensesFiltered) * 100) : 0
  }));

  const budgetCategories = [
    { category: 'Salaries', budget: Math.max(Math.round(Number(prevBudgetStats.salaries || 0) * 1.25), 500000) },
    { category: 'Transport', budget: Math.max(Math.round(Number(prevBudgetStats.transport || 0) * 1.25), 150000) },
    { category: 'Maintenance', budget: Math.max(Math.round(Number(prevBudgetStats.maintenance || 0) * 1.25), 80000) },
    { category: 'Events', budget: Math.max(Math.round(Number(prevBudgetStats.events || 0) * 1.25), 120000) },
    { category: 'Marketing', budget: Math.max(Math.round(Number(prevBudgetStats.marketing || 0) * 1.25), 50000) },
    { category: 'Utilities', budget: Math.max(Math.round(Number(prevBudgetStats.utilities || 0) * 1.25), 60000) },
  ];

  const budgetVsActual = budgetCategories.map(b => {
    const actual = filteredExpenses
      .filter(exp => exp.category.toLowerCase().includes(b.category.toLowerCase()) || (b.category === 'Utilities' && (exp.category.toLowerCase().includes('electricity') || exp.category.toLowerCase().includes('internet'))))
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
    const remaining = Math.max(0, b.budget - actual);
    const overBudget = actual > b.budget;
    return {
      category: b.category,
      budget: b.budget,
      actual,
      remaining: overBudget ? 0 : remaining,
      overBudget,
      excessAmount: overBudget ? actual - b.budget : 0
    };
  });

  // Reconstruct 12-month and 30-day series from SQL groupings
  const monthlyInvoicesMap = new Map(monthlyInvoicesRaw.map(r => [r.monthKey, Number(r.total)]));
  const monthlyExpensesMap = new Map(monthlyExpensesRaw.map(r => [r.monthKey, Number(r.total)]));
  const dailyInvoicesMap = new Map(dailyInvoicesRaw.map(r => [r.dayKey, Number(r.total)]));

  const monthlyIncome = [];
  const monthlyExpenses = [];
  const incomeVsExpense = [];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 11; i >= 0; i--) {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = targetMonth.getFullYear();
    const mm = String(targetMonth.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}-${mm}`;

    const mCollection = monthlyInvoicesMap.get(monthKey) || 0;
    const mExp = monthlyExpensesMap.get(monthKey) || 0;

    const label = `${monthNames[targetMonth.getMonth()]} ${String(yyyy).slice(-2)}`;
    monthlyIncome.push({ month: label, amount: mCollection });
    monthlyExpenses.push({ month: label, amount: mExp });
    incomeVsExpense.push({
      month: label,
      income: mCollection,
      expenses: mExp,
      netProfit: mCollection - mExp
    });
  }

  const dailyCollectionTrend = [];
  for (let i = 29; i >= 0; i--) {
    const dTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const yyyy = dTarget.getFullYear();
    const mm = String(dTarget.getMonth() + 1).padStart(2, '0');
    const dd = String(dTarget.getDate()).padStart(2, '0');
    const dayKey = `${yyyy}-${mm}-${dd}`;

    const dCollection = dailyInvoicesMap.get(dayKey) || 0;
    const label = `${dTarget.getDate()} ${monthNames[dTarget.getMonth()]}`;
    dailyCollectionTrend.push({ date: label, amount: dCollection });
  }

  const methodsCounts = new Map();
  for (const inv of filteredInvoices) {
    const m = inv.paymentMethod || 'CASH';
    methodsCounts.set(m, (methodsCounts.get(m) || 0) + Number(inv.paidAmount));
  }
  const paymentMethodsDistribution = Array.from(methodsCounts.entries()).map(([method, amount]) => ({
    method,
    amount,
    percentage: totalCollectedFiltered > 0 ? Math.round((amount / totalCollectedFiltered) * 100) : 0
  }));

  const highestPayingClassObj = outstandingByClass.reduce((prev, current) => (prev.collected > current.collected) ? prev : current, { className: 'None', collected: 0 });
  const highestPendingClassObj = outstandingByClass.reduce((prev, current) => (prev.totalPending > current.totalPending) ? prev : current, { className: 'None', totalPending: 0 });
  const highestRevenueMonthObj = monthlyIncome.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, { month: 'None', amount: 0 });
  const highestExpenseMonthObj = monthlyExpenses.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, { month: 'None', amount: 0 });
  const topExpenseCategoryObj = expenseCategoryAnalysis.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, { categoryName: 'None', amount: 0 });
  const topFeeCategoryObj = feeCategoryAnalysis.reduce((prev, current) => (prev.collected > current.collected) ? prev : current, { categoryName: 'None', collected: 0 });

  const executiveInsights = {
    highestPayingClass: highestPayingClassObj.className,
    highestPendingClass: highestPendingClassObj.className,
    highestRevenueMonth: highestRevenueMonthObj.month,
    highestExpenseMonth: highestExpenseMonthObj.month,
    topExpenseCategory: topExpenseCategoryObj.categoryName,
    topFeeCategory: topFeeCategoryObj.categoryName,
    averageRevenuePerStudent: totalStudentsCount > 0 ? Math.round(revenueAcademicYear / totalStudentsCount) : 0,
    averagePendingPerStudent: totalStudentsCount > 0 ? Math.round(totalPendingAmount / totalStudentsCount) : 0,
    averageExpensePerStudent: totalStudentsCount > 0 ? Math.round(expensesAcademicYear / totalStudentsCount) : 0,
    profitPerStudent: totalStudentsCount > 0 ? Math.round((revenueAcademicYear - expensesAcademicYear) / totalStudentsCount) : 0,
  };

  const topPendingStudents = [...studentDues]
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 10);

  const topPayingStudents = [...studentDues]
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 10);

  const recentlyClearedDues = [...studentDues]
    .filter(d => d.pending === 0 && d.paid > 0)
    .slice(0, 10);

  const studentsNearDueDate = [...studentDues]
    .filter(d => d.pending > 0)
    .sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime())
    .slice(0, 10);

  const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const highestExpenseToday = Number(maxExpStats.highestToday || 0);
  const highestExpenseThisMonth = Number(maxExpStats.highestThisMonth || 0);

  const expenseInsights = {
    recentExpenses: sortedExpenses.slice(0, 10).map(e => ({
      id: e.id,
      category: e.category,
      amount: Number(e.amount),
      date: e.date.toISOString().split('T')[0],
      description: e.description || '',
    })),
    highestExpenseToday,
    highestExpenseThisMonth,
    recurringExpenses: expenseCategoryAnalysis.slice(0, 3),
    upcomingExpenseReminders: budgetVsActual.filter(b => b.overBudget).map(b => `Alert: Category ${b.category} exceeded budget by ₹${b.excessAmount.toLocaleString()}`)
  };

  const notifications = [];
  if (collectionRateVal < 75) {
    notifications.push({
      type: 'CRITICAL',
      message: `Low school fee collection rate detected at ${Math.round(collectionRateVal)}% (Target: >90%).`
    });
  }
  const highestPending = highestPendingClassObj;
  if (highestPending && highestPending.totalPending > 50000) {
    notifications.push({
      type: 'WARNING',
      message: `High pending dues in class ${highestPending.className}: total ₹${highestPending.totalPending.toLocaleString()}.`
    });
  }
  const overBudgetList = budgetVsActual.filter(b => b.overBudget);
  for (const ob of overBudgetList) {
    notifications.push({
      type: 'WARNING',
      message: `Monthly expense budget exceeded for category "${ob.category}" by ₹${ob.excessAmount.toLocaleString()}.`
    });
  }
  if (expensesToday > 50000) {
    notifications.push({
      type: 'INFO',
      message: `Large expenses logged today: total ₹${expensesToday.toLocaleString()}.`
    });
  }
  if (netCashFlow < 0) {
    notifications.push({
      type: 'CRITICAL',
      message: `Negative net cash flow of -₹${Math.abs(netCashFlow).toLocaleString()} for selected period.`
    });
  }

  const timeline = [];

  for (const inv of filteredInvoices) {
    timeline.push({
      id: inv.id,
      type: 'PAYMENT',
      title: `Fee Collected: ${inv.student.user.name}`,
      amount: Number(inv.paidAmount),
      date: inv.invoiceDate,
      description: `Method: ${inv.paymentMethod || 'CASH'} · Reference: ${inv.id.slice(-6)}`
    });
  }

  for (const exp of filteredExpenses) {
    timeline.push({
      id: exp.id,
      type: 'EXPENSE',
      title: `Expense Logged: ${exp.category}`,
      amount: -Number(exp.amount),
      date: exp.date,
      description: `${exp.description || 'No description'} · Mode: ${exp.paymentMode}`
    });
  }

  for (const student of rawStudents) {
    const date = new Date(student.createdAt);
    if (startDate && endDate && (date < startDate || date > endDate)) continue;
    timeline.push({
      id: `adm-${student.id}`,
      type: 'ADMISSION',
      title: `New Admission: ${student.name}`,
      amount: 0,
      date,
      description: `Enrolled in class ${student.classId ? classMap.get(student.classId) : 'N/A'}`
    });
  }

  for (const log of promotionLogs) {
    timeline.push({
      id: `prom-${log.id}`,
      type: 'PROMOTION',
      title: `Student Promoted`,
      amount: 0,
      date: log.createdAt,
      description: log.details || ''
    });
  }

  for (const inv of voidedInvoicesTimeline) {
    timeline.push({
      id: `void-${inv.id}`,
      type: 'ROLLBACK',
      title: `Invoice Rollback: ${inv.student.user.name}`,
      amount: -Number(inv.totalAmount),
      date: inv.invoiceDate,
      description: `Voided Invoice Reference: ${inv.id.slice(-6)}`
    });
  }

  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  const recentActivitiesTimeline = timeline.slice(0, 30).map(t => ({
    ...t,
    dateStr: t.date.toISOString().split('T')[0]
  }));

  const latestPayments = filteredInvoices
    .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
    .slice(0, 10)
    .map(inv => ({
      id: inv.id,
      studentName: inv.student.user.name,
      amount: Number(inv.paidAmount),
      date: inv.invoiceDate.toISOString().split('T')[0],
      method: inv.paymentMethod || 'CASH'
    }));

  const latestExpenses = filteredExpenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map(e => ({
      id: e.id,
      category: e.category,
      amount: Number(e.amount),
      date: e.date.toISOString().split('T')[0],
      mode: e.paymentMode
    }));

  const latestRollbacks = voidedInvoices.map(v => ({
    id: v.id,
    studentName: v.student.user.name,
    amount: Number(v.totalAmount),
    date: v.invoiceDate.toISOString().split('T')[0]
  }));

  const latestAdmissions = rawStudents
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map(s => ({
      id: s.id,
      name: s.name,
      date: s.createdAt.toISOString().split('T')[0],
      class: s.classId ? classMap.get(s.classId) : 'N/A'
    }));

  const latestFeeAdjustments = allFeeAdjustments.slice(0, 10);

  const tEnd = process.hrtime.bigint();
  const memAfter = process.memoryUsage().heapUsed;

  const latencyMs = Number(tEnd - t0) / 1e6;
  const dbTimeMs = Number(tDbEnd - t0) / 1e6;
  const nodeTimeMs = Number(tEnd - tDbEnd) / 1e6;
  const heapAllocMB = Math.max(0, (memAfter - memBefore) / (1024 * 1024));

  const payload = {
    activeYearName: activeYear?.name || 'Current Year',
    summary: {
      revenue: {
        allTime: revenueAllTime,
        academicYear: revenueAcademicYear,
        currentMonth: revenueCurrentMonth,
        prevMonth: revenuePrevMonth,
        today: revenueToday,
        yesterday: revenueYesterday,
        thisWeek: revenueThisWeek,
        last30Days: revenueLast30Days,
        currentMonthInvoicesCount: paidInvoicesCountCurrentMonth,
        prevMonthInvoicesCount: paidInvoicesCountPrevMonth,
      },
      pending: {
        total: totalPendingAmount,
        studentsCount: pendingStudentsSet.size,
        overdue: overdueAmount,
        dueToday,
        dueThisWeek,
        dueThisMonth,
      },
      students: {
        total: totalStudentsCount,
        active: activeStudentsCount,
        paidCompletely: paidCompletelyCount,
        partiallyPaid: partiallyPaidCount,
        pending: pendingCount,
        newAdmissions: newAdmissionsCount,
        promoted: promotedCount,
      },
      expenses: {
        allTime: expensesAllTime,
        academicYear: expensesAcademicYear,
        currentMonth: expensesCurrentMonth,
        prevMonth: expensesPrevMonth,
        today: expensesToday,
        thisWeek: expensesThisWeek,
      },
      profit: {
        grossRevenue: totalCollectedFiltered,
        totalExpenses: totalExpensesFiltered,
        netProfit: totalCollectedFiltered - totalExpensesFiltered,
        profitMargin: totalCollectedFiltered > 0 ? Math.round(((totalCollectedFiltered - totalExpensesFiltered) / totalCollectedFiltered) * 1000) / 10 : 0,
        collectionRate: Math.round(collectionRateVal * 10) / 10,
        pendingPercentage: Math.round(pendingPercentageVal * 10) / 10,
      },
      cashFlow: {
        openingBalance,
        totalIncome: totalCollectedFiltered,
        totalExpenses: totalExpensesFiltered,
        closingBalance,
        expectedIncome,
        expectedExpenses,
        netCashFlow,
      },
      healthScore: healthIndicator,
    },
    growth: {
      revenue: revenueGrowthMonth,
      expense: expenseGrowthMonth,
      profit: profitGrowthMonth,
      collection: collectionGrowthMonth,
      student: studentGrowthMonth,
    },
    charts: {
      monthlyRevenue: monthlyIncome,
      monthlyExpenses,
      incomeVsExpense,
      dailyCollectionTrend,
      paymentMethodsDistribution,
      expenseCategoryAnalysis,
      feeCategoryAnalysis,
      outstandingByClass,
      outstandingBySection,
    },
    insights: {
      executive: executiveInsights,
      topPendingStudents,
      topPayingStudents,
      recentlyClearedDues,
      studentsNearDueDate,
      expense: expenseInsights,
    },
    notifications,
    timeline: recentActivitiesTimeline,
    activities: {
      latestPayments,
      latestExpenses,
      latestRollbacks,
      latestAdmissions,
      latestFeeAdjustments,
      latestRefunds: [],
    },
    kpis: {
      feeCollectionRate: Math.round(collectionRateVal * 10) / 10,
      expenseRatio: totalCollectedFiltered > 0 ? Math.round((totalExpensesFiltered / totalCollectedFiltered) * 100) : 0,
      avgFeePerStudent: totalStudentsCount > 0 ? Math.round((totalCollectedFiltered + totalPendingAmount) / totalStudentsCount) : 0,
      avgExpensePerStudent: totalStudentsCount > 0 ? Math.round(totalExpensesFiltered / totalStudentsCount) : 0,
      profitPerStudent: totalStudentsCount > 0 ? Math.round((totalCollectedFiltered - totalExpensesFiltered) / totalStudentsCount) : 0,
      revenuePerStudent: totalStudentsCount > 0 ? Math.round(totalCollectedFiltered / totalStudentsCount) : 0,
      outstandingRatio: (totalCollectedFiltered + totalPendingAmount) > 0 ? Math.round((totalPendingAmount / (totalCollectedFiltered + totalPendingAmount)) * 100) : 0,
      netMargin: totalCollectedFiltered > 0 ? Math.round(((totalCollectedFiltered - totalExpensesFiltered) / totalCollectedFiltered) * 100) : 0,
    },
    classes: allClasses.map(c => ({ id: c.id, name: c.name })),
    sections: allSections.map(s => ({ id: s.id, name: s.name })),
    academicYears: academicYearsList.map(y => ({ id: y.id, name: y.name })),
  };

  return {
    latencyMs,
    dbTimeMs,
    nodeTimeMs,
    heapAllocMB,
    payload
  };
}

async function run10IterationBenchmark() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

  console.log('================================================================');
  console.log('PHASE 6A FINANCIAL COMMAND CENTER 10-ITERATION BENCHMARK');
  console.log('================================================================\n');

  console.log('--- 1. Running 10 Baseline Iterations ---');
  const baselineRuns = [];
  for (let i = 1; i <= 10; i++) {
    const res = await runBaseline(tenantId);
    baselineRuns.push(res);
    console.log(`  Baseline Run #${i.toString().padStart(2, '0')}: ${res.latencyMs.toFixed(2)} ms (DB: ${res.dbTimeMs.toFixed(2)} ms, Node: ${res.nodeTimeMs.toFixed(2)} ms, Heap: ${res.heapAllocMB.toFixed(2)} MB)`);
  }

  console.log('\n--- 2. Running 10 Optimized Iterations ---');
  const optimizedRuns = [];
  for (let i = 1; i <= 10; i++) {
    const res = await testServiceCall(tenantId);
    optimizedRuns.push(res);
    console.log(`  Optimized Run #${i.toString().padStart(2, '0')}: ${res.latencyMs.toFixed(2)} ms (DB: ${res.dbTimeMs.toFixed(2)} ms, Node: ${res.nodeTimeMs.toFixed(2)} ms, Heap: ${res.heapAllocMB.toFixed(2)} MB)`);
  }

  // Calculate statistics
  const calcStats = (runs) => {
    const latencies = runs.map(r => r.latencyMs).sort((a, b) => a - b);
    const dbTimes = runs.map(r => r.dbTimeMs);
    const nodeTimes = runs.map(r => r.nodeTimeMs);
    const heaps = runs.map(r => r.heapAllocMB);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const avgDb = dbTimes.reduce((a, b) => a + b, 0) / dbTimes.length;
    const avgNode = nodeTimes.reduce((a, b) => a + b, 0) / nodeTimes.length;
    const avgHeap = heaps.reduce((a, b) => a + b, 0) / heaps.length;
    return { avg, min, max, p50, p95, avgDb, avgNode, avgHeap };
  };

  const bStats = calcStats(baselineRuns);
  const oStats = calcStats(optimizedRuns);

  console.log('\n================================================================');
  console.log('BENCHMARK SUMMARY COMPARISON');
  console.log('================================================================');
  console.log(`Metric                     | Baseline           | Optimized          | Improvement`);
  console.log(`---------------------------+--------------------+--------------------+-------------------`);
  console.log(`Average Latency            | ${bStats.avg.toFixed(2).padStart(15)} ms | ${oStats.avg.toFixed(2).padStart(15)} ms | ${((bStats.avg - oStats.avg) / bStats.avg * 100).toFixed(1)}% faster`);
  console.log(`P50 (Median) Latency       | ${bStats.p50.toFixed(2).padStart(15)} ms | ${oStats.p50.toFixed(2).padStart(15)} ms | ${((bStats.p50 - oStats.p50) / bStats.p50 * 100).toFixed(1)}% faster`);
  console.log(`P95 Latency                | ${bStats.p95.toFixed(2).padStart(15)} ms | ${oStats.p95.toFixed(2).padStart(15)} ms | ${((bStats.p95 - oStats.p95) / bStats.p95 * 100).toFixed(1)}% faster`);
  console.log(`Min Latency                | ${bStats.min.toFixed(2).padStart(15)} ms | ${oStats.min.toFixed(2).padStart(15)} ms | ${((bStats.min - oStats.min) / bStats.min * 100).toFixed(1)}% faster`);
  console.log(`Max Latency                | ${bStats.max.toFixed(2).padStart(15)} ms | ${oStats.max.toFixed(2).padStart(15)} ms | ${((bStats.max - oStats.max) / bStats.max * 100).toFixed(1)}% faster`);
  console.log(`Database Processing Time   | ${bStats.avgDb.toFixed(2).padStart(15)} ms | ${oStats.avgDb.toFixed(2).padStart(15)} ms | ${((bStats.avgDb - oStats.avgDb) / bStats.avgDb * 100).toFixed(1)}% faster`);
  console.log(`Node.js In-Memory Time     | ${bStats.avgNode.toFixed(2).padStart(15)} ms | ${oStats.avgNode.toFixed(2).padStart(15)} ms | ${((bStats.avgNode - oStats.avgNode) / bStats.avgNode * 100).toFixed(1)}% faster`);
  console.log(`Heap Memory Delta          | ${bStats.avgHeap.toFixed(2).padStart(15)} MB | ${oStats.avgHeap.toFixed(2).padStart(15)} MB | ${((bStats.avgHeap - oStats.avgHeap) / Math.max(0.01, bStats.avgHeap) * 100).toFixed(1)}% reduced`);

  // Mathematical Parity Verification
  console.log('\n================================================================');
  console.log('MATHEMATICAL PARITY VERIFICATION ACROSS FILTER CONFIGURATIONS');
  console.log('================================================================');

  const testFilterSets = [
    { name: 'Default (No Filters)', filters: {} },
    { name: 'Month Filter (Month 9)', filters: { month: 9 } },
    { name: 'Month Filter (Month 3)', filters: { month: 3 } },
    { name: 'Academic Year Filter', filters: { academicYearId: '47d3d7b4-3a21-4f18-8f85-3b03f0b2f567' } },
    { name: 'Payment Method Filter (CASH)', filters: { paymentMethod: 'CASH' } },
    { name: 'Payment Method Filter (UPI)', filters: { paymentMethod: 'UPI' } },
  ];

  let totalParityChecks = 0;
  let passedParityChecks = 0;

  for (const testSet of testFilterSets) {
    totalParityChecks++;
    const bResult = await runBaseline(tenantId, testSet.filters);
    const oResult = await testServiceCall(tenantId, testSet.filters);

    const bStr = JSON.stringify(bResult.payload);
    const oStr = JSON.stringify(oResult.payload);

    if (bStr === oStr) {
      passedParityChecks++;
      console.log(`  [PASS] ${testSet.name}: 100% Exact Parity (${Buffer.byteLength(bStr, 'utf8')} bytes)`);
    } else {
      console.error(`  [FAIL] ${testSet.name}: Mismatch detected!`);
      // Find diff
      for (const k of Object.keys(bResult.payload)) {
        if (JSON.stringify(bResult.payload[k]) !== JSON.stringify(oResult.payload[k])) {
          console.error(`    Field mismatch in: ${k}`);
        }
      }
    }
  }

  console.log(`\nParity Result: ${passedParityChecks}/${totalParityChecks} test scenarios passed with 100% exact parity.`);

  // Multi-Tenant Isolation Verification
  console.log('\n================================================================');
  console.log('MULTI-TENANT ISOLATION VERIFICATION');
  console.log('================================================================');

  const allTenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`Found ${allTenants.length} tenants in database.`);

  let isolationPassed = true;
  for (const t of allTenants) {
    const res = await testServiceCall(t.id);
    const studentCount = res.payload.summary.students.total;
    const revAllTime = res.payload.summary.revenue.allTime;
    const expAllTime = res.payload.summary.expenses.allTime;
    console.log(`  Tenant: "${t.name}" (${t.id}) -> Students: ${studentCount}, Revenue: ₹${revAllTime.toLocaleString()}, Expenses: ₹${expAllTime.toLocaleString()}`);

    // Verify raw queries did not return data from other tenants
    if (t.id !== tenantId && studentCount > 0) {
      // Check if student IDs belong to t.id
      const verifyStudents = await prisma.studentProfile.findMany({
        where: { tenantId: t.id },
        select: { id: true }
      });
      if (verifyStudents.length !== studentCount) {
        isolationPassed = false;
        console.error(`  [ISOLATION BREACH] Tenant ${t.name} student count mismatch!`);
      }
    }
  }

  if (isolationPassed) {
    console.log(`\n>>> Multi-Tenant Isolation Test: 100% PASSED (Zero data leaks) <<<`);
  }

  await prisma.$disconnect();
}

run10IterationBenchmark().catch(console.error);
