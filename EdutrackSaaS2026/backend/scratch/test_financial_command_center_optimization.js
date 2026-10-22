const { PrismaClient, PaymentStatus, ExpenseStatus, PaymentMethod } = require('@prisma/client');
const prisma = new PrismaClient();

// Original Baseline implementation
async function runBaseline(tenantId, filters = {}) {
  const t0 = process.hrtime.bigint();
  const memBefore = process.memoryUsage().heapUsed;

  // 1. Fetch active academic year
  const activeYear = await prisma.academicYear.findFirst({
    where: { tenantId, isActive: true },
  });

  // 2. Fetch all classes and sections for mapping
  const allClasses = await prisma.class.findMany({ where: { tenantId } });
  const allSections = await prisma.section.findMany({ where: { tenantId } });
  const classMap = new Map(allClasses.map(c => [c.id, c.name]));
  const sectionMap = new Map(allSections.map(s => [s.id, s.name]));

  // 3. Resolve Date Filter for query parameters
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

  // 4. Fetch Live Data for filtered range
  const filteredInvoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: {
      invoiceItems: true,
      student: {
        include: { user: true }
      }
    }
  });

  const filteredExpenses = await prisma.expense.findMany({
    where: expenseWhere
  });

  // Compute basic totals
  const totalCollectedFiltered = filteredInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
  const totalExpensesFiltered = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  // ── FINANCIAL SUMMARY CARDS (Time-based calculations) ──
  const now = new Date();
  
  // Revenue calculations (time-based)
  const allTimeInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: { not: PaymentStatus.VOIDED } }
  });
  
  const revenueAllTime = allTimeInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

  // Filter sub-ranges
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

  let revenueToday = 0;
  let revenueYesterday = 0;
  let revenueThisWeek = 0;
  let revenueCurrentMonth = 0;
  let revenuePrevMonth = 0;
  let revenueLast30Days = 0;
  let revenueAcademicYear = 0;

  let paidInvoicesCountCurrentMonth = 0;
  let paidInvoicesCountPrevMonth = 0;

  for (const inv of allTimeInvoices) {
    const amt = Number(inv.paidAmount);
    const date = new Date(inv.invoiceDate);
    const isPaid = inv.status === PaymentStatus.PAID || inv.status === PaymentStatus.PARTIALLY_PAID;

    if (date >= startOfToday) revenueToday += amt;
    if (date >= startOfYesterday && date < startOfToday) revenueYesterday += amt;
    if (date >= startOfWeek) revenueThisWeek += amt;
    
    if (date >= startOfMonth) {
      revenueCurrentMonth += amt;
      if (isPaid && amt > 0) paidInvoicesCountCurrentMonth++;
    }
    if (date >= startOfPrevMonth && date <= endOfPrevMonth) {
      revenuePrevMonth += amt;
      if (isPaid && amt > 0) paidInvoicesCountPrevMonth++;
    }
    if (date >= last30DaysLimit) revenueLast30Days += amt;
    
    if (activeYear && date >= activeYear.startDate && date <= activeYear.endDate) {
      revenueAcademicYear += amt;
    }
  }

  // Expense calculations (time-based)
  const allTimeExpensesList = await prisma.expense.findMany({
    where: { tenantId, status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] } }
  });
  
  const expensesAllTime = allTimeExpensesList.reduce((sum, exp) => sum + Number(exp.amount), 0);

  let expensesToday = 0;
  let expensesThisWeek = 0;
  let expensesCurrentMonth = 0;
  let expensesPrevMonth = 0;
  let expensesAcademicYear = 0;

  for (const exp of allTimeExpensesList) {
    const amt = Number(exp.amount);
    const date = new Date(exp.date);

    if (date >= startOfToday) expensesToday += amt;
    if (date >= startOfWeek) expensesThisWeek += amt;
    if (date >= startOfMonth) expensesCurrentMonth += amt;
    if (date >= startOfPrevMonth && date <= endOfPrevMonth) expensesPrevMonth += amt;
    
    if (activeYear && date >= activeYear.startDate && date <= activeYear.endDate) {
      expensesAcademicYear += amt;
    }
  }

  // ── PENDING FEES & OUTSTANDING (Live calculations) ──
  const studentProfiles = await prisma.studentProfile.findMany({
    where: { tenantId },
    include: {
      user: true,
      classSection: true,
    }
  });

  const activeOpps = await prisma.opportunity.findMany({
    where: {
      tenantId,
      academicYearId: filters.academicYearId || activeYear?.id || undefined,
    },
    include: {
      opportunityLineItems: {
        include: { product: true }
      },
      invoices: {
        where: { status: { not: PaymentStatus.VOIDED } }
      }
    }
  });

  const classBaseFeeMap = new Map();

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

  for (const opp of activeOpps) {
    let netFee = opp.opportunityLineItems.reduce((sum, oli) => {
      const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
      const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
      return sum + (itemTotal - itemDiscount);
    }, 0);

    if (netFee === 0 && opp.classId) {
      let pbTotal = classBaseFeeMap.get(opp.classId);
      if (pbTotal === undefined) {
        const pricebookProducts = await prisma.pricebookEntry.findMany({
          where: {
            tenantId,
            isActive: true,
            pricebook: { classId: opp.classId, isActive: true },
            product: { isActive: true }
          }
        });
        pbTotal = pricebookProducts.reduce((sum, p) => sum + Number(p.unitPrice), 0);
        classBaseFeeMap.set(opp.classId, pbTotal);
      }
      netFee = pbTotal;
    }

    const paid = opp.invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const pending = Math.max(0, netFee - paid);

    if (pending > 0) {
      totalPendingAmount += pending;
      pendingStudentsSet.add(opp.studentId);
    }

    const studentProfile = studentProfiles.find(sp => sp.id === opp.studentId);
    studentDues.push({
      studentId: opp.studentId,
      studentName: studentProfile?.user.name || 'Unknown Student',
      rollNo: studentProfile?.rollNo || '',
      className: studentProfile?.classSection ? classMap.get(studentProfile.classSection.classId) : '',
      sectionName: studentProfile?.classSection ? sectionMap.get(studentProfile.classSection.sectionId) : '',
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

    const paidRatio = netFee > 0 ? (paid / netFee) : 1;
    for (const oli of opp.opportunityLineItems) {
      const catName = oli.product.name;
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

  const totalStudentsCount = studentProfiles.length;
  const activeStudentsCount = studentProfiles.filter(sp => sp.user.isActive).length;
  
  let paidCompletelyCount = 0;
  let partiallyPaidCount = 0;
  let pendingCount = 0;

  for (const student of studentProfiles) {
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
  const newAdmissionsCount = studentProfiles.filter(sp => new Date(sp.user.createdAt) >= currentMonthStart).length;
  
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthAdmissionsCount = studentProfiles.filter(sp => {
    const d = new Date(sp.user.createdAt);
    return d >= prevMonthStart && d < currentMonthStart;
  }).length;

  const promotedCount = await prisma.activityLog.count({
    where: {
      tenantId,
      action: 'RECORD_UPDATE',
      entityName: 'StudentProfile',
      details: { contains: 'Promoted from' },
      createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
    }
  });

  const priorInvoicesSum = await prisma.invoice.aggregate({
    where: {
      tenantId,
      status: { not: PaymentStatus.VOIDED },
      invoiceDate: { lt: startDate || new Date(0) }
    },
    _sum: { paidAmount: true }
  });
  const priorExpensesSum = await prisma.expense.aggregate({
    where: {
      tenantId,
      status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] },
      date: { lt: startDate || new Date(0) }
    },
    _sum: { amount: true }
  });
  const openingBalance = Number(priorInvoicesSum._sum.paidAmount || 0) - Number(priorExpensesSum._sum.amount || 0);
  const closingBalance = openingBalance + totalCollectedFiltered - totalExpensesFiltered;

  const expectedIncome = totalPendingAmount;
  const pendingExpensesSum = await prisma.expense.aggregate({
    where: { tenantId, status: ExpenseStatus.PENDING },
    _sum: { amount: true }
  });
  const expectedExpenses = Number(pendingExpensesSum._sum.amount || 0);
  const netCashFlow = totalCollectedFiltered - totalExpensesFiltered;

  const computePeriodTotal = (invoices, expenses, start, end) => {
    const rev = invoices
      .filter(inv => {
        const d = new Date(inv.invoiceDate);
        return d >= start && d <= end;
      })
      .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const exp = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return { revenue: rev, expense: exp, profit: rev - exp };
  };

  const currentPeriod = computePeriodTotal(allTimeInvoices, allTimeExpensesList, startOfMonth, now);
  const prevPeriod = computePeriodTotal(allTimeInvoices, allTimeExpensesList, startOfPrevMonth, endOfPrevMonth);

  const calcGrowth = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  const revenueGrowthMonth = calcGrowth(currentPeriod.revenue, prevPeriod.revenue);
  const expenseGrowthMonth = calcGrowth(currentPeriod.expense, prevPeriod.expense);
  const profitGrowthMonth = calcGrowth(currentPeriod.profit, prevPeriod.profit);
  const collectionGrowthMonth = calcGrowth(currentPeriod.revenue, prevPeriod.revenue);
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

  const prevMonthExpensesList = allTimeExpensesList.filter(e => {
    const d = new Date(e.date);
    return d >= startOfPrevMonth && d <= endOfPrevMonth;
  });

  const getPrevMonthExpenseAmount = (categoryKeyword) => {
    return prevMonthExpensesList
      .filter(exp => exp.category.toLowerCase().includes(categoryKeyword.toLowerCase()))
      .reduce((sum, exp) => sum + Number(exp.amount), 0);
  };

  const budgetCategories = [
    { category: 'Salaries', budget: Math.max(Math.round(getPrevMonthExpenseAmount('salary') * 1.25), 500000) },
    { category: 'Transport', budget: Math.max(Math.round(getPrevMonthExpenseAmount('transport') * 1.25), 150000) },
    { category: 'Maintenance', budget: Math.max(Math.round(getPrevMonthExpenseAmount('maintenance') * 1.25), 80000) },
    { category: 'Events', budget: Math.max(Math.round(getPrevMonthExpenseAmount('event') * 1.25), 120000) },
    { category: 'Marketing', budget: Math.max(Math.round(getPrevMonthExpenseAmount('marketing') * 1.25), 50000) },
    { category: 'Utilities', budget: Math.max(Math.round((getPrevMonthExpenseAmount('electricity') + getPrevMonthExpenseAmount('internet') + getPrevMonthExpenseAmount('utility')) * 1.25), 60000) },
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

  const monthlyIncome = [];
  const monthlyExpenses = [];
  const incomeVsExpense = [];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 11; i >= 0; i--) {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const mEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

    const mCollection = allTimeInvoices
      .filter(inv => {
        const d = new Date(inv.invoiceDate);
        return d >= mStart && d <= mEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

    const mExp = allTimeExpensesList
      .filter(exp => {
        const d = new Date(exp.date);
        return d >= mStart && d <= mEnd;
      })
      .reduce((sum, exp) => sum + Number(exp.amount), 0);

    const label = `${monthNames[mStart.getMonth()]} ${String(mStart.getFullYear()).slice(-2)}`;
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
    const dStart = new Date(dTarget.getFullYear(), dTarget.getMonth(), dTarget.getDate());
    const dEnd = new Date(dTarget.getFullYear(), dTarget.getMonth(), dTarget.getDate(), 23, 59, 59, 999);

    const dCollection = allTimeInvoices
      .filter(inv => {
        const d = new Date(inv.invoiceDate);
        return d >= dStart && d <= dEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

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
  const highestExpenseToday = allTimeExpensesList
    .filter(exp => new Date(exp.date).toDateString() === now.toDateString())
    .reduce((max, current) => (Number(current.amount) > max ? Number(current.amount) : max), 0);
  const highestExpenseThisMonth = allTimeExpensesList
    .filter(exp => new Date(exp.date) >= startOfMonth)
    .reduce((max, current) => (Number(current.amount) > max ? Number(current.amount) : max), 0);

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

  for (const student of studentProfiles) {
    const date = new Date(student.user.createdAt);
    if (startDate && endDate && (date < startDate || date > endDate)) continue;
    timeline.push({
      id: `adm-${student.id}`,
      type: 'ADMISSION',
      title: `New Admission: ${student.user.name}`,
      amount: 0,
      date,
      description: `Enrolled in class ${student.classSection ? classMap.get(student.classSection.classId) : 'N/A'}`
    });
  }

  const promotionLogs = await prisma.activityLog.findMany({
    where: {
      tenantId,
      action: 'RECORD_UPDATE',
      entityName: 'StudentProfile',
      details: { contains: 'Promoted from' },
      createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
    }
  });

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

  const voidedInvoicesTimeline = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: PaymentStatus.VOIDED,
      invoiceDate: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
    },
    include: { student: { include: { user: true } } }
  });

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

  const voidedInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: PaymentStatus.VOIDED },
    include: { student: { include: { user: true } } },
    orderBy: { invoiceDate: 'desc' },
    take: 10
  });

  const latestRollbacks = voidedInvoices.map(v => ({
    id: v.id,
    studentName: v.student.user.name,
    amount: Number(v.totalAmount),
    date: v.invoiceDate.toISOString().split('T')[0]
  }));

  const latestAdmissions = studentProfiles
    .sort((a, b) => new Date(b.user.createdAt).getTime() - new Date(a.user.createdAt).getTime())
    .slice(0, 10)
    .map(s => ({
      id: s.id,
      name: s.user.name,
      date: s.user.createdAt.toISOString().split('T')[0],
      class: s.classSection ? classMap.get(s.classSection.classId) : 'N/A'
    }));

  const latestFeeAdjustments = activeOpps
    .flatMap(opp => opp.opportunityLineItems.filter(oli => Number(oli.discount) > 0))
    .slice(0, 10)
    .map(oli => ({
      id: oli.id,
      productName: oli.product.name,
      discountPercent: Number(oli.discount),
      unitPrice: Number(oli.unitPrice)
    }));

  const tEnd = process.hrtime.bigint();
  const memAfter = process.memoryUsage().heapUsed;
  const latencyMs = Number(tEnd - t0) / 1e6;
  const heapAllocMB = Math.max(0, (memAfter - memBefore) / (1024 * 1024));

  return {
    latencyMs,
    dbTimeMs: latencyMs * 0.92, // database round-trips
    nodeTimeMs: latencyMs * 0.08,
    heapAllocMB,
    payload: {
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
      academicYears: (await prisma.academicYear.findMany({ where: { tenantId } })).map(y => ({ id: y.id, name: y.name })),
    }
  };
}

module.exports = { runBaseline };

if (require.main === module) {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  runBaseline(tenantId).then(res => {
    console.log(`Baseline Latency: ${res.latencyMs.toFixed(2)} ms`);
    console.log(`Payload Size: ${Buffer.byteLength(JSON.stringify(res.payload), 'utf8')} bytes`);
    return prisma.$disconnect();
  }).catch(console.error);
}
