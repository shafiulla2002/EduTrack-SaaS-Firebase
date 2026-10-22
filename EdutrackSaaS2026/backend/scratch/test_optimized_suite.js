const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

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

  const t0 = performance.now();

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

    // Populate billing info and student details for ONLY the 20 paged students
    const [studentsData, targetAy] = await Promise.all([
      pagedStudentIds.length > 0 ? prisma.studentProfile.findMany({
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
      }) : [],
      academicYearId ? prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true, startDate: true } }) : null
    ]);

    const studentMap = new Map(studentsData.map(s => [s.id, s]));
    const pagedData = rows.map(r => {
      const s = studentMap.get(r.studentId);
      if (!s) return null;

      const totalFees = r.totalFees;
      const paidAmount = r.paidAmount;
      const balanceDue = r.balanceDue;
      const pendingPercentage = totalFees > 0 ? Math.round((balanceDue / totalFees) * 100) : 0;
      const paidPercentage = totalFees > 0 ? Math.round((paidAmount / totalFees) * 100) : 100;
      const finStatus = balanceDue > 0 ? `Pending Due (${pendingPercentage}%)` : 'Fully Paid (100%)';

      return {
        ...s,
        paidAmount,
        balanceDue,
        totalFees,
        pendingPercentage,
        paidPercentage,
        financialStatus: finStatus,
        feeSummary: null
      };
    }).filter(Boolean);

    const duration = performance.now() - t0;
    return {
      data: pagedData,
      total: filteredTotal,
      page,
      limit,
      totalPages: Math.ceil(filteredTotal / limit),
      duration
    };
  }
}

async function runSuite() {
  console.log('=== TESTING SUITE ACROSS ALL FINANCIAL FILTERS & COMBINATIONS ===\n');

  const tests = [
    { name: '1. PENDING_BALANCE (Page 1)', params: { financialStatus: 'PENDING_BALANCE', page: 1, limit: 20 } },
    { name: '2. PENDING_BALANCE (Page 2)', params: { financialStatus: 'PENDING_BALANCE', page: 2, limit: 20 } },
    { name: '3. FULLY_PAID (Page 1)', params: { financialStatus: 'FULLY_PAID', page: 1, limit: 20 } },
    { name: '4. BELOW_50 (Page 1)', params: { financialStatus: 'BELOW_50', page: 1, limit: 20 } },
    { name: '5. ABOVE_75 (Page 1)', params: { financialStatus: 'ABOVE_75', page: 1, limit: 20 } },
    { name: '6. PAID_50_75 (Page 1)', params: { financialStatus: 'PAID_50_75', page: 1, limit: 20 } },
    { name: '7. Search "Khan" + PENDING_BALANCE', params: { searchTerm: 'Khan', financialStatus: 'PENDING_BALANCE', page: 1, limit: 20 } },
    { name: '8. Search "A" + BELOW_50', params: { searchTerm: 'A', financialStatus: 'BELOW_50', page: 1, limit: 20 } },
  ];

  for (const t of tests) {
    const res = await optimizedSearchStudents(t.params);
    console.log(`Test [${t.name}]:`);
    console.log(`   - Total Matching: ${res.total}`);
    console.log(`   - Returned Rows: ${res.data.length}`);
    console.log(`   - Duration: ${res.duration.toFixed(1)}ms`);
    if (res.data.length > 0) {
      console.log(`   - Sample 1st Student: [${res.data[0].user?.name}] | Roll: ${res.data[0].rollNo} | Due: ₹${res.data[0].balanceDue} | Status: ${res.data[0].financialStatus}`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

runSuite().catch(err => {
  console.error(err);
  process.exit(1);
});
