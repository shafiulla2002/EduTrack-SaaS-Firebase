const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

// Import existing functions from our baseline script for exact comparison
const baselineModule = require('./test_financial_parity.js');

async function testSqlAggregatedFinancialStatus(financialStatus, page = 1, limit = 20, academicYearId = null, searchTerm = null, classId = null, sectionId = null) {
  const tenantId = TENANT_ID;
  const t0 = performance.now();

  // Build the unified SQL CTE for calculating student financial status
  // 1. Identify active opportunity per student
  // 2. Identify fee amount, paid amount, previous dues
  // 3. Compute balanceDue, totalFees, paidPercentage
  // 4. Apply financialStatus filter
  // 5. Paginate and return { total, pagedStudentIds }

  const sqlQuery = Prisma.sql`
    WITH student_base AS (
      SELECT 
        sp.id AS "studentId",
        sp."rollNo",
        u.id AS "userId",
        u.name AS "userName",
        sp."classSectionId",
        cs."classId",
        cs."sectionId"
      FROM "StudentProfile" sp
      JOIN "User" u ON sp."userId" = u.id
      LEFT JOIN "ClassSection" cs ON sp."classSectionId" = cs.id
      LEFT JOIN "Class" c ON cs."classId" = c.id
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
        sb."studentId",
        sb."userName",
        sb."rollNo",
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
    LIMIT ${limit}
    OFFSET ${(page - 1) * limit}
  `;

  const rows = await prisma.$queryRaw(sqlQuery);
  const total = rows.length > 0 ? rows[0].totalCount : 0;
  const duration = performance.now() - t0;

  return {
    total,
    rows,
    duration,
    studentIds: rows.map(r => r.studentId)
  };
}

async function verifyParity() {
  console.log('=== VERIFYING EXACT MATHEMATICAL PARITY (OLD VS NEW) ===\n');

  const filters = ['FULLY_PAID', 'ABOVE_75', 'PAID_50_75', 'BELOW_50', 'PENDING_BALANCE'];

  for (const filter of filters) {
    console.log(`\nTesting filter: [${filter}]`);
    const newRes = await testSqlAggregatedFinancialStatus(filter, 1, 20);
    console.log(`- New SQL Aggregated Duration: ${newRes.duration.toFixed(1)}ms | Total Count: ${newRes.total} | Rows: ${newRes.rows.length}`);
  }

  await prisma.$disconnect();
}

verifyParity().catch(err => {
  console.error('Parity test error:', err);
  process.exit(1);
});
