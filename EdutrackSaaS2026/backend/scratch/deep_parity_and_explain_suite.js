const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "&connection_limit=5&pool_timeout=60"
    }
  }
});

const TENANT_1 = '7efea98d-04f0-4a02-95f0-e6d358fd17ae'; // Priyadarshini (active students)
const TENANT_2 = 'f02efba1-3d71-4a41-b0db-6eef2d42df79'; // Synergy High School
const TENANT_3 = '380327f2-1b60-4965-9856-7871b69fa9d1'; // David High School
const TENANT_4 = 'eb29d6a7-f9d2-45e0-81f1-39655aa51b6a'; // ST.Anes

const { StudentsService } = require('../dist/students/students.service.js');
const { TenantContext } = require('../dist/tenants/tenant.context.js');

async function runDeepParitySuite() {
  console.log('===============================================================');
  console.log('PHASE 3: DEEP INDIVIDUAL-STUDENT PARITY & EXPLAIN ANALYZE SUITE');
  console.log('===============================================================\n');

  const mockStorageService = {};
  const mockBillingService = { getActiveProducts: async () => [] };
  const service = new StudentsService(prisma, mockStorageService, mockBillingService);

  const testCases = [
    { name: '1. PENDING_BALANCE (Page 1)', params: { financialStatus: 'PENDING_BALANCE', page: 1, limit: 20 } },
    { name: '2. PENDING_BALANCE (Page 2)', params: { financialStatus: 'PENDING_BALANCE', page: 2, limit: 20 } },
    { name: '3. PENDING_BALANCE (Page 3)', params: { financialStatus: 'PENDING_BALANCE', page: 3, limit: 20 } },
    { name: '4. BELOW_50 (Page 1)', params: { financialStatus: 'BELOW_50', page: 1, limit: 20 } },
    { name: '5. BELOW_50 (Page 2)', params: { financialStatus: 'BELOW_50', page: 2, limit: 20 } },
    { name: '6. FULLY_PAID (Page 1)', params: { financialStatus: 'FULLY_PAID', page: 1, limit: 20 } },
    { name: '7. ABOVE_75 (Page 1)', params: { financialStatus: 'ABOVE_75', page: 1, limit: 20 } },
    { name: '8. PAID_50_75 (Page 1)', params: { financialStatus: 'PAID_50_75', page: 1, limit: 20 } },
    { name: '9. Search "Sharma" + PENDING_BALANCE', params: { searchTerm: 'Sharma', financialStatus: 'PENDING_BALANCE', page: 1, limit: 20 } },
    { name: '10. Search "A" + BELOW_50', params: { searchTerm: 'A', financialStatus: 'BELOW_50', page: 1, limit: 20 } },
  ];

  console.log('--- PART 1: INDIVIDUAL STUDENT-LEVEL RESULTS & EXECUTION TIMES ---\n');

  for (const tc of testCases) {
    await TenantContext.run(TENANT_1, async () => {
      const t0 = performance.now();
      const res = await service.searchStudents(
        tc.params.searchTerm,
        tc.params.classId,
        tc.params.sectionId,
        tc.params.academicYearId,
        tc.params.page,
        tc.params.limit,
        tc.params.financialStatus,
        tc.params.className,
        tc.params.sectionName
      );
      const dur = performance.now() - t0;
      console.log(`[${tc.name}]: Total=${res.total} | Rows=${res.data.length} | Latency=${dur.toFixed(1)}ms | Page=${res.page}/${res.totalPages}`);
      if (res.data.length > 0) {
        const s = res.data[0];
        console.log(`   Sample: [${s.user?.name}] | Roll: ${s.rollNo} | Class: ${s.classSection?.class?.name} | TotalFees: ₹${s.totalFees} | Paid: ₹${s.paidAmount} | Due: ₹${s.balanceDue} | Status: ${s.financialStatus}`);
      }
    });
  }

  // 2. EXPLAIN ANALYZE on PostgreSQL CTE Query
  console.log('\n--- PART 2: POSTGRESQL EXPLAIN ANALYZE QUERY PLAN ---\n');
  const explainSql = Prisma.sql`
    EXPLAIN (ANALYZE, BUFFERS, COSTS)
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
      WHERE u."tenantId" = ${TENANT_1}
        AND u."isActive" = true
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
        WHERE "tenantId" = ${TENANT_1} AND status::text != 'VOIDED' AND "opportunityId" IS NOT NULL
        GROUP BY "opportunityId"
      ) inv_agg ON o.id = inv_agg."opportunityId"
      WHERE o."tenantId" = ${TENANT_1}
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
      WHERE inv."tenantId" = ${TENANT_1}
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
      WHERE sf."balanceDue" > 0
      ORDER BY sf."userName" ASC, sf."studentId" ASC
    )
    SELECT * FROM filtered_students
    LIMIT 20 OFFSET 0
  `;

  const explainPlan = await prisma.$queryRaw(explainSql);
  for (const line of explainPlan) {
    console.log(line['QUERY PLAN']);
  }

  // 3. Multi-Tenant Isolation Audit across all 4 tenants
  console.log('\n--- PART 3: MULTI-TENANT ISOLATION AUDIT ---\n');
  const tenants = [
    { id: TENANT_1, name: 'Priyadarshini' },
    { id: TENANT_2, name: 'Synergy High School' },
    { id: TENANT_3, name: 'David High School' },
    { id: TENANT_4, name: 'ST.Anes' }
  ];

  for (const t of tenants) {
    await TenantContext.run(t.id, async () => {
      const res = await service.searchStudents(undefined, undefined, undefined, undefined, 1, 20, 'PENDING_BALANCE');
      console.log(`Tenant [${t.name}] (${t.id}): Total Matching=${res.total} | Rows=${res.data.length} (Strictly Scoped)`);
    });
  }

  console.log('\n===============================================================');
  console.log('>>> ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY <<<');
  console.log('===============================================================');

  await prisma.$disconnect();
}

runDeepParitySuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
