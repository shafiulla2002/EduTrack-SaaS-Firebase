const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

// Full implementation of the proposed optimized searchStudents
async function optimizedSearchStudents({
  searchTerm,
  classId,
  sectionId,
  academicYearId,
  page = 1,
  limit = 20,
  financialStatus,
  className,
  sectionName
}) {
  const tenantId = TENANT_ID;
  const isPaginated = page !== undefined && limit !== undefined;
  const skip = isPaginated ? (page - 1) * limit : 0;
  const take = isPaginated ? limit : 20;

  // If financialStatus filter is applied, perform database-level aggregation, filtering, and pagination
  if (financialStatus && financialStatus !== 'ALL' && financialStatus !== 'All') {
    const sqlQuery = Prisma.sql`
      WITH student_base AS (
        SELECT 
          sp.id AS "studentId",
          sp."rollNo",
          sp."fatherName",
          sp."motherName",
          sp."fatherPhone",
          sp."motherPhone",
          sp."guardianPhone",
          sp."aadharNo",
          sp."profilePhotoUrl",
          sp."classSectionId",
          sp."tenantId",
          u.id AS "userId",
          u.name AS "userName",
          u.email AS "userEmail",
          u.phone AS "userPhone",
          cs."classId",
          cs."sectionId",
          c.name AS "className",
          c."academicYearId" AS "academicYearId",
          s.name AS "sectionName"
        FROM "StudentProfile" sp
        JOIN "User" u ON sp."userId" = u.id
        LEFT JOIN "ClassSection" cs ON sp."classSectionId" = cs.id
        LEFT JOIN "Class" c ON cs."classId" = c.id
        LEFT JOIN "Section" s ON cs."sectionId" = s.id
        WHERE u."tenantId" = ${tenantId}
          AND u."isActive" = true
          ${searchTerm ? Prisma.sql`AND (
            sp."rollNo" ILIKE ${'%' + searchTerm + '%'} OR
            sp."fatherName" ILIKE ${'%' + searchTerm + '%'} OR
            sp."motherName" ILIKE ${'%' + searchTerm + '%'} OR
            sp."fatherPhone" ILIKE ${'%' + searchTerm + '%'} OR
            sp."motherPhone" ILIKE ${'%' + searchTerm + '%'} OR
            sp."guardianPhone" ILIKE ${'%' + searchTerm + '%'} OR
            u.name ILIKE ${'%' + searchTerm + '%'} OR
            u.email ILIKE ${'%' + searchTerm + '%'} OR
            u.phone ILIKE ${'%' + searchTerm + '%'}
          )` : Prisma.empty}
          ${classId ? Prisma.sql`AND cs."classId" = ${classId}` : Prisma.empty}
          ${sectionId ? Prisma.sql`AND cs."sectionId" = ${sectionId}` : Prisma.empty}
          ${className && !classId ? Prisma.sql`AND c.name ILIKE ${className}` : Prisma.empty}
          ${sectionName && !sectionId ? Prisma.sql`AND s.name ILIKE ${'%' + sectionName.replace(/^section\s*[-_]?/i, '').trim() + '%'}` : Prisma.empty}
          ${academicYearId ? Prisma.sql`AND c."academicYearId" = ${academicYearId}` : Prisma.empty}
      ),
      student_opps AS (
        SELECT 
          o.id,
          o."studentId",
          o."stageName",
          o."academicYearId",
          o."classId",
          o."createdAt",
          ay."startDate" AS "ay_startDate",
          ay.name AS "ay_name",
          COALESCE(SUM((oli."unitPrice" * COALESCE(oli.quantity, 1)) - ((oli."unitPrice" * COALESCE(oli.quantity, 1) * COALESCE(oli.discount, 0)) / 100.0)), 0)::float AS "oppFee",
          COALESCE(inv_agg."paidAmount", 0)::float AS "oppPaid",
          ROW_NUMBER() OVER (
            PARTITION BY o."studentId" 
            ORDER BY 
              ${academicYearId ? Prisma.sql`CASE WHEN o."academicYearId" = ${academicYearId} THEN 0 ELSE 1 END,` : Prisma.empty}
              CASE WHEN o."stageName" NOT IN ('Closed Won', 'Closed Lost') THEN 0 ELSE 1 END,
              o."createdAt" DESC
          ) AS "rn"
        FROM "Opportunity" o
        JOIN student_base sb ON o."studentId" = sb."studentId"
        LEFT JOIN "AcademicYear" ay ON o."academicYearId" = ay.id
        LEFT JOIN "OpportunityLineItem" oli ON o.id = oli."opportunityId"
        LEFT JOIN (
          SELECT "opportunityId", COALESCE(SUM("paidAmount"), 0)::float AS "paidAmount"
          FROM "Invoice"
          WHERE "tenantId" = ${tenantId} AND status::text != 'VOIDED' AND "opportunityId" IS NOT NULL
          GROUP BY "opportunityId"
        ) inv_agg ON o.id = inv_agg."opportunityId"
        WHERE o."tenantId" = ${tenantId}
        GROUP BY o.id, o."studentId", o."stageName", o."academicYearId", o."classId", o."createdAt", ay."startDate", ay.name, inv_agg."paidAmount"
      ),
      active_opps AS (
        SELECT * FROM student_opps WHERE rn = 1
      ),
      prev_opp_dues AS (
        SELECT 
          so."studentId",
          COALESCE(SUM(GREATEST(0, so."oppFee" - so."oppPaid")), 0)::float AS "prevOppDue"
        FROM student_opps so
        JOIN active_opps ao ON so."studentId" = ao."studentId"
        WHERE so."ay_startDate" IS NOT NULL 
          AND ao."ay_startDate" IS NOT NULL 
          AND so."ay_startDate" < ao."ay_startDate"
        GROUP BY so."studentId"
      ),
      orphan_inv_dues AS (
        SELECT 
          inv."studentId",
          COALESCE(SUM(inv."remainingBalance"), 0)::float AS "orphanDue"
        FROM "Invoice" inv
        JOIN student_base sb ON inv."studentId" = sb."studentId"
        LEFT JOIN active_opps ao ON inv."studentId" = ao."studentId"
        WHERE inv."tenantId" = ${tenantId}
          AND inv."opportunityId" IS NULL
          AND inv.status::text IN ('UNPAID', 'PARTIALLY_PAID')
          AND (ao."ay_startDate" IS NULL OR inv."invoiceDate" < ao."ay_startDate")
        GROUP BY inv."studentId"
      ),
      student_financials AS (
        SELECT 
          sb.*,
          COALESCE(ao."oppPaid", 0)::float AS "paidAmount",
          (
            GREATEST(0, COALESCE(ao."oppFee", 0) - COALESCE(ao."oppPaid", 0)) + 
            COALESCE(pod."prevOppDue", 0) + 
            COALESCE(oid."orphanDue", 0)
          )::float AS "balanceDue",
          (
            COALESCE(ao."oppPaid", 0) + 
            GREATEST(0, COALESCE(ao."oppFee", 0) - COALESCE(ao."oppPaid", 0)) + 
            COALESCE(pod."prevOppDue", 0) + 
            COALESCE(oid."orphanDue", 0)
          )::float AS "totalFees",
          CASE 
            WHEN (
              COALESCE(ao."oppPaid", 0) + 
              GREATEST(0, COALESCE(ao."oppFee", 0) - COALESCE(ao."oppPaid", 0)) + 
              COALESCE(pod."prevOppDue", 0) + 
              COALESCE(oid."orphanDue", 0)
            ) > 0 
            THEN (
              COALESCE(ao."oppPaid", 0) / 
              (
                COALESCE(ao."oppPaid", 0) + 
                GREATEST(0, COALESCE(ao."oppFee", 0) - COALESCE(ao."oppPaid", 0)) + 
                COALESCE(pod."prevOppDue", 0) + 
                COALESCE(oid."orphanDue", 0)
              )
            ) * 100.0
            ELSE (
              CASE WHEN (
                GREATEST(0, COALESCE(ao."oppFee", 0) - COALESCE(ao."oppPaid", 0)) + 
                COALESCE(pod."prevOppDue", 0) + 
                COALESCE(oid."orphanDue", 0)
              ) <= 0 THEN 100.0 ELSE 0.0 END
            )
          END AS "paidPercent"
        FROM student_base sb
        LEFT JOIN active_opps ao ON sb."studentId" = ao."studentId"
        LEFT JOIN prev_opp_dues pod ON sb."studentId" = pod."studentId"
        LEFT JOIN orphan_inv_dues oid ON sb."studentId" = oid."studentId"
      ),
      filtered_students AS (
        SELECT 
          sf.*,
          COUNT(*) OVER()::int AS "totalCount"
        FROM student_financials sf
        WHERE 
          ${financialStatus === 'FULLY_PAID' ? Prisma.sql`sf."balanceDue" <= 0 OR sf."paidPercent" >= 99.99` :
            financialStatus === 'ABOVE_75' ? Prisma.sql`sf."paidPercent" > 75 AND sf."paidPercent" < 99.99 AND sf."balanceDue" > 0` :
            financialStatus === 'PAID_50_75' ? Prisma.sql`sf."paidPercent" >= 50 AND sf."paidPercent" <= 75 AND sf."balanceDue" > 0` :
            financialStatus === 'BELOW_50' ? Prisma.sql`sf."paidPercent" < 50` :
            financialStatus === 'PENDING_BALANCE' ? Prisma.sql`sf."balanceDue" > 0` :
            Prisma.sql`TRUE`
          }
        ORDER BY sf."userName" ASC
      )
      SELECT * FROM filtered_students
      LIMIT ${take}
      OFFSET ${skip}
    `;

    const rows = await prisma.$queryRaw(sqlQuery);
    const filteredTotal = rows.length > 0 ? rows[0].totalCount : 0;
    const pagedStudentIds = rows.map(r => r.studentId);

    // Fetch rich billing info for ONLY the paginated students (20 rows)
    const [studentsData, billingMap] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { id: { in: pagedStudentIds } },
        select: {
          id: true,
          rollNo: true,
          fatherName: true,
          motherName: true,
          fatherPhone: true,
          motherPhone: true,
          guardianPhone: true,
          aadharNo: true,
          profilePhotoUrl: true,
          classSectionId: true,
          tenantId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          classSection: {
            select: {
              id: true,
              classId: true,
              sectionId: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  academicYearId: true,
                }
              },
              section: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          }
        }
      }),
      existingGetStudentsBillingInfoBatch(pagedStudentIds, tenantId, academicYearId)
    ]);

    // Preserve the exact alphabetical order by userName
    const studentMap = new Map(studentsData.map(s => [s.id, s]));
    const pagedData = pagedStudentIds.map(id => {
      const s = studentMap.get(id);
      if (!s) return null;
      const billingInfo = billingMap[s.id] || {
        paidAmount: 0,
        balanceDue: 0,
        totalFees: 0,
        pendingPercentage: 0,
        paidPercentage: 100,
        financialStatus: 'Fully Paid (100%)',
        feeSummary: null
      };
      return {
        ...s,
        paidAmount: billingInfo.paidAmount,
        balanceDue: billingInfo.totalPendingBalance,
        totalFees: billingInfo.totalFees,
        pendingPercentage: billingInfo.pendingPercentage,
        paidPercentage: billingInfo.paidPercentage,
        financialStatus: billingInfo.financialStatus,
        feeSummary: billingInfo.feeSummary
      };
    }).filter(Boolean);

    if (isPaginated) {
      return {
        data: pagedData,
        total: filteredTotal,
        page,
        limit,
        totalPages: Math.ceil(filteredTotal / limit)
      };
    }
    return pagedData;
  }
}

// Copy of original searchStudents for comparison
async function originalSearchStudents({
  searchTerm,
  classId,
  sectionId,
  academicYearId,
  page = 1,
  limit = 20,
  financialStatus,
  className,
  sectionName
}) {
  const tenantId = TENANT_ID;
  const where = {
    tenantId,
    user: { isActive: true }
  };

  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.trim();
    where.OR = [
      { rollNo: { contains: term, mode: 'insensitive' } },
      { fatherName: { contains: term, mode: 'insensitive' } },
      { motherName: { contains: term, mode: 'insensitive' } },
      { fatherPhone: { contains: term, mode: 'insensitive' } },
      { motherPhone: { contains: term, mode: 'insensitive' } },
      { guardianPhone: { contains: term, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
          ]
        }
      }
    ];
  }

  const classSectionFilter = {};
  if (classId) classSectionFilter.classId = classId;
  if (sectionId) classSectionFilter.sectionId = sectionId;

  const classFilter = {};
  if (academicYearId) classFilter.academicYearId = academicYearId;
  if (className && !classId) classFilter.name = { equals: className, mode: 'insensitive' };
  if (Object.keys(classFilter).length > 0) classSectionFilter.class = classFilter;

  if (sectionName && !sectionId) {
    const cleanSec = sectionName.replace(/^section\s*[-_]?/i, '').trim();
    classSectionFilter.section = { name: { contains: cleanSec, mode: 'insensitive' } };
  }
  if (Object.keys(classSectionFilter).length > 0) where.classSection = classSectionFilter;

  const isPaginated = page !== undefined && limit !== undefined;
  const skip = isPaginated ? (page - 1) * limit : undefined;
  const take = isPaginated ? limit : undefined;

  const allStudents = await prisma.studentProfile.findMany({
    where,
    select: {
      id: true,
      rollNo: true,
      fatherName: true,
      motherName: true,
      fatherPhone: true,
      motherPhone: true,
      guardianPhone: true,
      aadharNo: true,
      profilePhotoUrl: true,
      classSectionId: true,
      tenantId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      },
      classSection: {
        select: {
          id: true,
          classId: true,
          sectionId: true,
          class: {
            select: {
              id: true,
              name: true,
              academicYearId: true,
            }
          },
          section: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      }
    },
    orderBy: { user: { name: 'asc' } }
  });

  const studentIds = allStudents.map(s => s.id);
  const billingMap = await existingGetStudentsBillingInfoBatch(studentIds, tenantId, academicYearId);

  const allData = allStudents.map(s => {
    const billingInfo = billingMap[s.id] || {
      paidAmount: 0,
      balanceDue: 0,
      totalFees: 0,
      pendingPercentage: 0,
      paidPercentage: 100,
      financialStatus: 'Fully Paid (100%)',
      feeSummary: null
    };
    return {
      ...s,
      paidAmount: billingInfo.paidAmount,
      balanceDue: billingInfo.totalPendingBalance,
      totalFees: billingInfo.totalFees,
      pendingPercentage: billingInfo.pendingPercentage,
      paidPercentage: billingInfo.paidPercentage,
      financialStatus: billingInfo.financialStatus,
      feeSummary: billingInfo.feeSummary
    };
  });

  const filteredData = allData.filter(s => {
    const due = Number(s.balanceDue) || 0;
    const total = Number(s.totalFees) || (Number(s.paidAmount) + due);
    const paid = Number(s.paidAmount) || 0;
    const paidPercent = total > 0 ? (paid / total) * 100 : (due <= 0 ? 100 : 0);

    switch (financialStatus) {
      case 'FULLY_PAID':
        return due <= 0 || paidPercent >= 99.99;
      case 'ABOVE_75':
        return paidPercent > 75 && paidPercent < 99.99 && due > 0;
      case 'PAID_50_75':
        return paidPercent >= 50 && paidPercent <= 75 && due > 0;
      case 'BELOW_50':
        return paidPercent < 50;
      case 'PENDING_BALANCE':
        return due > 0;
      default:
        return true;
    }
  });

  const filteredTotal = filteredData.length;
  const pagedData = isPaginated ? filteredData.slice(skip, skip + limit) : filteredData;

  if (isPaginated) {
    return {
      data: pagedData,
      total: filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit)
    };
  }
  return pagedData;
}

// Helper: existingGetStudentsBillingInfoBatch from baseline
async function existingGetStudentsBillingInfoBatch(studentIds, tenantId, academicYearId) {
  if (studentIds.length === 0) return {};
  const [oppRows, orphanInvoices, targetAcademicYear] = await Promise.all([
    prisma.$queryRaw`
      SELECT 
        o.id,
        o."studentId",
        o."stageName",
        o."academicYearId",
        o."classId",
        o."createdAt",
        ay.id AS "ay_id",
        ay.name AS "ay_name",
        ay."startDate" AS "ay_startDate",
        COUNT(oli.id)::int AS "lineItemCount",
        COALESCE(SUM((oli."unitPrice" * COALESCE(oli.quantity, 1)) - ((oli."unitPrice" * COALESCE(oli.quantity, 1) * COALESCE(oli.discount, 0)) / 100.0)), 0)::float AS "totalFee",
        COALESCE(inv_agg."paidAmount", 0)::float AS "totalPaid"
      FROM "Opportunity" o
      LEFT JOIN "AcademicYear" ay ON o."academicYearId" = ay.id
      LEFT JOIN "OpportunityLineItem" oli ON o.id = oli."opportunityId"
      LEFT JOIN (
        SELECT "opportunityId", COALESCE(SUM("paidAmount"), 0)::float AS "paidAmount"
        FROM "Invoice"
        WHERE "tenantId" = ${tenantId} AND status::text != 'VOIDED' AND "opportunityId" IS NOT NULL
        GROUP BY "opportunityId"
      ) inv_agg ON o.id = inv_agg."opportunityId"
      WHERE o."tenantId" = ${tenantId} AND o."studentId" IN (${Prisma.join(studentIds)})
      GROUP BY o.id, o."studentId", o."stageName", o."academicYearId", o."classId", o."createdAt", ay.id, ay.name, ay."startDate", inv_agg."paidAmount"
      ORDER BY o."createdAt" DESC
    `,
    prisma.$queryRaw`
      SELECT 
        id,
        "studentId",
        "remainingBalance"::float AS "remainingBalance",
        "invoiceDate"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId} 
        AND "studentId" IN (${Prisma.join(studentIds)})
        AND "opportunityId" IS NULL
        AND status::text IN ('UNPAID', 'PARTIALLY_PAID')
    `,
    academicYearId
      ? prisma.academicYear.findUnique({
          where: { id: academicYearId },
          select: { id: true, startDate: true },
        })
      : Promise.resolve(null),
  ]);

  const oppsByStudent = new Map();
  for (const opp of oppRows) {
    if (!oppsByStudent.has(opp.studentId)) oppsByStudent.set(opp.studentId, []);
    oppsByStudent.get(opp.studentId).push(opp);
  }

  const orphansByStudent = new Map();
  for (const inv of orphanInvoices) {
    if (!orphansByStudent.has(inv.studentId)) orphansByStudent.set(inv.studentId, []);
    orphansByStudent.get(inv.studentId).push(inv);
  }

  const billingMap = {};
  for (const studentId of studentIds) {
    const studentOpps = oppsByStudent.get(studentId) || [];
    const studentOrphans = orphansByStudent.get(studentId) || [];

    let openOpp = academicYearId
      ? studentOpps.find(opp => opp.academicYearId === academicYearId)
      : studentOpps.find(opp => !['Closed Won', 'Closed Lost'].includes(opp.stageName));
    if (!openOpp) openOpp = studentOpps[0] || null;

    let totalFee = openOpp?.totalFee || 0;
    let totalPaid = openOpp?.totalPaid || 0;

    let currentYearStart = new Date(0);
    if (academicYearId) {
      const cy = openOpp?.academicYearId === academicYearId
        ? openOpp
        : studentOpps.find(opp => opp.academicYearId === academicYearId);
      if (cy && cy.ay_startDate) currentYearStart = cy.ay_startDate;
      else if (targetAcademicYear) currentYearStart = targetAcademicYear.startDate;
    } else if (openOpp && openOpp.ay_startDate) {
      currentYearStart = openOpp.ay_startDate;
    }

    const prevOpps = studentOpps.filter(opp => opp.ay_startDate && new Date(opp.ay_startDate) < currentYearStart);
    const prevYearDuesMap = new Map();
    for (const opp of prevOpps) {
      const yearName = opp.ay_name || 'Previous Years';
      const oppFee = opp.totalFee || 0;
      const oppPaid = opp.totalPaid || 0;
      const balance = Math.max(0, oppFee - oppPaid);
      if (balance > 0) prevYearDuesMap.set(yearName, (prevYearDuesMap.get(yearName) || 0) + balance);
    }

    const prevOrphanInvoices = studentOrphans.filter(inv => new Date(inv.invoiceDate) < currentYearStart);
    for (const inv of prevOrphanInvoices) {
      const yearName = 'Previous Years';
      const balance = Number(inv.remainingBalance);
      if (balance > 0) prevYearDuesMap.set(yearName, (prevYearDuesMap.get(yearName) || 0) + balance);
    }

    const previousYears = Array.from(prevYearDuesMap.entries()).map(([academicYearName, outstandingBalance]) => ({
      academicYearName,
      outstandingBalance
    }));

    const totalPreviousYearDue = previousYears.reduce((sum, item) => sum + item.outstandingBalance, 0);
    const currentYearPending = Math.max(0, totalFee - totalPaid);
    const grandTotalBalanceDue = currentYearPending + totalPreviousYearDue;
    const totalFees = totalPaid + grandTotalBalanceDue;
    const pendingPercentage = totalFees > 0 ? Math.round((grandTotalBalanceDue / totalFees) * 100) : 0;
    const paidPercentage = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 100;
    const financialStatus = grandTotalBalanceDue > 0 ? `Pending Due (${pendingPercentage}%)` : 'Fully Paid (100%)';

    billingMap[studentId] = {
      totalFees,
      paidAmount: totalPaid,
      currentYearPending,
      previousYearPending: totalPreviousYearDue,
      totalPendingBalance: grandTotalBalanceDue,
      pendingPercentage,
      paidPercentage,
      financialStatus,
    };
  }
  return billingMap;
}

async function runComprehensiveParityTests() {
  console.log('=== COMPREHENSIVE FINANCIAL FILTER PARITY TEST SUITE ===\n');

  const testCases = [
    { name: '1. PENDING_BALANCE (Page 1)', params: { financialStatus: 'PENDING_BALANCE', page: 1, limit: 20 } },
    { name: '2. PENDING_BALANCE (Page 2)', params: { financialStatus: 'PENDING_BALANCE', page: 2, limit: 20 } },
    { name: '3. FULLY_PAID (Page 1)', params: { financialStatus: 'FULLY_PAID', page: 1, limit: 20 } },
    { name: '4. BELOW_50 (Page 1)', params: { financialStatus: 'BELOW_50', page: 1, limit: 20 } },
    { name: '5. ABOVE_75 (Page 1)', params: { financialStatus: 'ABOVE_75', page: 1, limit: 20 } },
    { name: '6. PAID_50_75 (Page 1)', params: { financialStatus: 'PAID_50_75', page: 1, limit: 20 } },
    { name: '7. Search "Khan" + PENDING_BALANCE', params: { searchTerm: 'Khan', financialStatus: 'PENDING_BALANCE', page: 1, limit: 20 } },
  ];

  for (const tc of testCases) {
    console.log(`Running Test Case: ${tc.name}...`);
    const t0Old = performance.now();
    const oldRes = await originalSearchStudents(tc.params);
    const oldDur = performance.now() - t0Old;

    const t0New = performance.now();
    const newRes = await optimizedSearchStudents(tc.params);
    const newDur = performance.now() - t0New;

    // Verify Totals
    const totalMatch = oldRes.total === newRes.total;
    const countMatch = oldRes.data.length === newRes.data.length;

    // Verify student IDs and order
    let studentsMatch = true;
    for (let i = 0; i < oldRes.data.length; i++) {
      const o = oldRes.data[i];
      const n = newRes.data[i];
      if (!n || o.id !== n.id || o.totalFees !== n.totalFees || o.paidAmount !== n.paidAmount || o.balanceDue !== n.balanceDue || o.financialStatus !== n.financialStatus) {
        console.error(`MISMATCH at index ${i}:`, { old: o, new: n });
        studentsMatch = false;
        break;
      }
    }

    console.log(`   - Total Count Match: ${totalMatch} (Old: ${oldRes.total}, New: ${newRes.total})`);
    console.log(`   - Page Rows Match: ${countMatch} (${oldRes.data.length} rows)`);
    console.log(`   - All Student Records Match: ${studentsMatch}`);
    console.log(`   - Latency: Old=${oldDur.toFixed(1)}ms → New=${newDur.toFixed(1)}ms (${((oldDur - newDur) / oldDur * 100).toFixed(1)}% faster)\n`);

    if (!totalMatch || !countMatch || !studentsMatch) {
      console.error(`TEST FAILED FOR: ${tc.name}`);
      process.exit(1);
    }
  }

  console.log('=== ALL COMPREHENSIVE PARITY TESTS PASSED WITH 100% MATCH ===');
  await prisma.$disconnect();
}

runComprehensiveParityTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
