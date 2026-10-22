const { PrismaClient, PaymentStatus, ExpenseStatus, PaymentMethod } = require('@prisma/client');
const prisma = new PrismaClient();

async function traceBreakdown() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
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

  console.log('Tracing individual queries for getFinancialCommandCenterData...');

  async function timeStep(label, fn) {
    const t0 = process.hrtime.bigint();
    const res = await fn();
    const t1 = process.hrtime.bigint();
    const ms = Number(t1 - t0) / 1e6;
    console.log(`  ${ms.toFixed(2).padStart(8)} ms | ${label} (Rows/Result: ${Array.isArray(res) ? res.length : (res ? 1 : 0)})`);
    return res;
  }

  const activeYear = await timeStep('1. Active Year', () => prisma.academicYear.findFirst({ where: { tenantId, isActive: true } }));
  const allClasses = await timeStep('2. All Classes', () => prisma.class.findMany({ where: { tenantId }, select: { id: true, name: true } }));
  const allSections = await timeStep('3. All Sections', () => prisma.section.findMany({ where: { tenantId }, select: { id: true, name: true } }));
  const pricebooks = await timeStep('4. Pricebooks', () => prisma.pricebookEntry.findMany({
    where: { tenantId, isActive: true, pricebook: { isActive: true }, product: { isActive: true } },
    select: { unitPrice: true, pricebook: { select: { classId: true } } }
  }));

  const ayStart = activeYear?.startDate || new Date(0);
  const ayEnd = activeYear?.endDate || new Date(0);
  const hasAY = Boolean(activeYear?.startDate && activeYear?.endDate);

  await timeStep('5. Revenue Aggregates ($queryRaw)', () => prisma.$queryRaw`
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
    WHERE "tenantId" = ${tenantId} AND "status" != 'VOIDED'
  `);

  await timeStep('6. Expense Aggregates ($queryRaw)', () => prisma.$queryRaw`
    SELECT
      COALESCE(SUM("amount"), 0)::float AS "allTime",
      COALESCE(SUM(CASE WHEN "date" >= ${startOfToday} THEN "amount" ELSE 0 END), 0)::float AS "today",
      COALESCE(SUM(CASE WHEN "date" >= ${startOfWeek} THEN "amount" ELSE 0 END), 0)::float AS "thisWeek",
      COALESCE(SUM(CASE WHEN "date" >= ${startOfMonth} THEN "amount" ELSE 0 END), 0)::float AS "currentMonth",
      COALESCE(SUM(CASE WHEN "date" >= ${startOfPrevMonth} AND "date" <= ${endOfPrevMonth} THEN "amount" ELSE 0 END), 0)::float AS "prevMonth",
      COALESCE(SUM(CASE WHEN ${hasAY} AND "date" >= ${ayStart} AND "date" <= ${ayEnd} THEN "amount" ELSE 0 END), 0)::float AS "academicYear"
    FROM "Expense"
    WHERE "tenantId" = ${tenantId} AND "status" IN ('PAID', 'APPROVED')
  `);

  await timeStep('7. 12-Month Invoices Grouping ($queryRaw)', () => prisma.$queryRaw`
    SELECT to_char("invoiceDate", 'YYYY-MM') AS "monthKey", COALESCE(SUM("paidAmount"), 0)::float AS "total"
    FROM "Invoice" WHERE "tenantId" = ${tenantId} AND "status" != 'VOIDED' AND "invoiceDate" >= ${targetTwelveMonth} GROUP BY 1
  `);

  await timeStep('8. 12-Month Expenses Grouping ($queryRaw)', () => prisma.$queryRaw`
    SELECT to_char("date", 'YYYY-MM') AS "monthKey", COALESCE(SUM("amount"), 0)::float AS "total"
    FROM "Expense" WHERE "tenantId" = ${tenantId} AND "status" IN ('PAID', 'APPROVED') AND "date" >= ${targetTwelveMonth} GROUP BY 1
  `);

  await timeStep('9. 30-Day Invoices Grouping ($queryRaw)', () => prisma.$queryRaw`
    SELECT to_char("invoiceDate", 'YYYY-MM-DD') AS "dayKey", COALESCE(SUM("paidAmount"), 0)::float AS "total"
    FROM "Invoice" WHERE "tenantId" = ${tenantId} AND "status" != 'VOIDED' AND "invoiceDate" >= ${targetThirtyDays} GROUP BY 1
  `);

  await timeStep('10. Filtered Invoices (lightweight)', () => prisma.invoice.findMany({
    where: { tenantId, status: { not: PaymentStatus.VOIDED } },
    select: { id: true, paidAmount: true, invoiceDate: true, paymentMethod: true, student: { select: { user: { select: { name: true } } } } }
  }));

  await timeStep('11. Filtered Expenses (lightweight)', () => prisma.expense.findMany({
    where: { tenantId, status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] } },
    select: { id: true, category: true, amount: true, date: true, description: true, paymentMode: true }
  }));

  await timeStep('12. Student Profiles (lightweight)', () => prisma.studentProfile.findMany({
    where: { tenantId },
    select: { id: true, rollNo: true, classSection: { select: { classId: true, sectionId: true } }, user: { select: { name: true, isActive: true, createdAt: true } } }
  }));

  await timeStep('13. Active Opportunities with Line Items & Invoices', () => prisma.opportunity.findMany({
    where: { tenantId, academicYearId: activeYear?.id || undefined },
    select: {
      id: true, studentId: true, classId: true, sectionId: true, closeDate: true,
      opportunityLineItems: { select: { unitPrice: true, quantity: true, discount: true, product: { select: { name: true } } } },
      invoices: { where: { status: { not: PaymentStatus.VOIDED } }, select: { paidAmount: true } }
    }
  }));

  await prisma.$disconnect();
}

traceBreakdown().catch(console.error);
