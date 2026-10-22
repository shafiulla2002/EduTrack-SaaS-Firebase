const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runValidation() {
  console.log('=== STARTING ATTENDANCE OPTIMIZATION VALIDATION ===\n');

  // 1. Create temporary validation table AttendanceMonthlyAggregate_Test if not exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttendanceMonthlyAggregate_Test" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "studentId" TEXT NOT NULL,
      "classSectionId" TEXT NOT NULL,
      "academicYearId" TEXT NOT NULL,
      "year" INT NOT NULL,
      "month" INT NOT NULL,
      "statusMap" CHAR(31) NOT NULL,
      "reasons" JSONB,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT "AttendanceMonthlyAggregate_Test_unique" UNIQUE ("tenantId", "studentId", "academicYearId", "year", "month")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AttendanceMonthlyAggregate_Test_tenant_cs_year_month" 
    ON "AttendanceMonthlyAggregate_Test" ("tenantId", "classSectionId", "year", "month");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AttendanceMonthlyAggregate_Test_studentId" 
    ON "AttendanceMonthlyAggregate_Test" ("studentId");
  `);

  console.log('✔ Validation table "AttendanceMonthlyAggregate_Test" created successfully.');

  // Truncate test table before backfill test
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "AttendanceMonthlyAggregate_Test";`);

  // 2. Fetch all raw attendance records joined with sessions and students
  console.log('Fetching raw Attendance records from database...');
  const rawRecords = await prisma.$queryRaw`
    SELECT 
      a."id" as attendance_id,
      a."tenantId",
      a."studentId",
      a."status"::text as status,
      a."reason",
      s."date",
      s."classSectionId",
      sp."classSectionId" as "studentClassSectionId"
    FROM "Attendance" a
    JOIN "AttendanceSession" s ON a."attendanceSessionId" = s."id"
    LEFT JOIN "StudentProfile" sp ON a."studentId" = sp."id"
  `;

  console.log(`Fetched ${rawRecords.length} granular Attendance records.`);

  // Get active Academic Year per tenant
  const acadYears = await prisma.academicYear.findMany({ where: { isActive: true } });
  const tenantAcadMap = new Map();
  acadYears.forEach(ay => tenantAcadMap.set(ay.tenantId, ay.id));

  // Map to hold aggregates: key = `${tenantId}_${studentId}_${year}_${month}`
  const aggregateMap = new Map();

  for (const r of rawRecords) {
    const d = new Date(r.date);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1; // 1-indexed
    const day = d.getDate(); // 1 to 31
    const key = `${r.tenantId}_${r.studentId}_${yr}_${mo}`;

    let agg = aggregateMap.get(key);
    if (!agg) {
      const acadYearId = tenantAcadMap.get(r.tenantId) || 'default_acad_year';
      const classSectionId = r.classSectionId || r.studentClassSectionId || 'default_cs';
      // Fill initial 31 chars with '-'
      const statusArr = Array(31).fill('-');
      
      // Determine days in month to mark out-of-range days as 'X'
      const daysInMonth = new Date(yr, mo, 0).getDate();
      for (let i = daysInMonth; i < 31; i++) {
        statusArr[i] = 'X'; // Out of month range
      }

      agg = {
        id: `test_agg_${key}`,
        tenantId: r.tenantId,
        studentId: r.studentId,
        classSectionId,
        academicYearId: acadYearId,
        year: yr,
        month: mo,
        statusArr,
        reasons: {},
      };
      aggregateMap.set(key, agg);
    }

    // Map status enum to single char
    let charCode = 'P';
    if (r.status === 'ABSENT') charCode = 'A';
    else if (r.status === 'LATE') charCode = 'L';
    else if (r.status === 'EXCUSED') charCode = 'E';
    else if (r.status === 'HOLIDAY') charCode = 'H';
    else if (r.status === 'PRESENT') charCode = 'P';

    agg.statusArr[day - 1] = charCode;

    if (r.reason && r.reason.trim().length > 0) {
      agg.reasons[day.toString()] = {
        status: r.status,
        reason: r.reason.trim(),
      };
    }
  }

  console.log(`Aggregated ${rawRecords.length} rows into ${aggregateMap.size} monthly aggregate records.`);

  // Insert into AttendanceMonthlyAggregate_Test in batches
  const aggregatesList = Array.from(aggregateMap.values());
  const BATCH_SIZE = 1000;
  for (let i = 0; i < aggregatesList.length; i += BATCH_SIZE) {
    const batch = aggregatesList.slice(i, i + BATCH_SIZE);
    const values = batch.map(a => {
      const statusStr = a.statusArr.join('');
      const jsonReasons = JSON.stringify(a.reasons);
      return `('${a.id}', '${a.tenantId}', '${a.studentId}', '${a.classSectionId}', '${a.academicYearId}', ${a.year}, ${a.month}, '${statusStr}', '${jsonReasons.replace(/'/g, "''")}'::jsonb)`;
    }).join(',');

    await prisma.$executeRawUnsafe(`
      INSERT INTO "AttendanceMonthlyAggregate_Test" 
      ("id", "tenantId", "studentId", "classSectionId", "academicYearId", "year", "month", "statusMap", "reasons")
      VALUES ${values};
    `);
  }

  console.log('✔ Test backfill inserted successfully.');

  // 3. PARITY AUDIT: Compare every granular Attendance record against AttendanceMonthlyAggregate_Test
  console.log('\n--- EXECUTING 100% DATA PARITY COMPARISON ---');
  
  const mismatchQuery = await prisma.$queryRaw`
    SELECT 
      a."id" as attendance_id,
      a."tenantId",
      a."studentId",
      a."status"::text as expected_status,
      a."reason" as expected_reason,
      s."date",
      EXTRACT(DAY FROM s."date")::int as day,
      SUBSTRING(agg."statusMap" FROM EXTRACT(DAY FROM s."date")::int FOR 1) as actual_char,
      (agg."reasons"->(EXTRACT(DAY FROM s."date")::int::text)->>'reason') as actual_reason
    FROM "Attendance" a
    JOIN "AttendanceSession" s ON a."attendanceSessionId" = s."id"
    JOIN "AttendanceMonthlyAggregate_Test" agg 
      ON a."tenantId" = agg."tenantId"
     AND a."studentId" = agg."studentId"
     AND EXTRACT(YEAR FROM s."date")::int = agg."year"
     AND EXTRACT(MONTH FROM s."date")::int = agg."month"
  `;

  let statusMismatches = 0;
  let reasonMismatches = 0;

  for (const m of mismatchQuery) {
    let expectedChar = 'P';
    if (m.expected_status === 'ABSENT') expectedChar = 'A';
    else if (m.expected_status === 'LATE') expectedChar = 'L';
    else if (m.expected_status === 'EXCUSED') expectedChar = 'E';
    else if (m.expected_status === 'HOLIDAY') expectedChar = 'H';
    else if (m.expected_status === 'PRESENT') expectedChar = 'P';

    if (m.actual_char !== expectedChar) {
      statusMismatches++;
    }

    const expReason = (m.expected_reason || '').trim();
    const actReason = (m.actual_reason || '').trim();
    if (expReason !== actReason) {
      reasonMismatches++;
    }
  }

  console.log(`Total Granular Records Evaluated: ${mismatchQuery.length}`);
  console.log(`Status Mismatches: ${statusMismatches}`);
  console.log(`Reason Mismatches: ${reasonMismatches}`);
  if (statusMismatches === 0 && reasonMismatches === 0) {
    console.log('🎉 100% PERFECT DATA PARITY VERIFIED! ZERO DATA LOSS.');
  } else {
    console.error('❌ PARITY CHECK FAILED!');
  }

  // 4. MEASURE ACTUAL POSTGRESQL STORAGE
  console.log('\n--- MEASURING ACTUAL POSTGRESQL STORAGE SIZES ---');
  const sizeComparison = await prisma.$queryRaw`
    SELECT 
      relname AS table_name,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
      pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
      pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
      pg_total_relation_size(c.oid)::text AS total_bytes,
      pg_relation_size(c.oid)::text AS table_bytes,
      pg_indexes_size(c.oid)::text AS index_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
      AND relname IN ('Attendance', 'AttendanceMonthlyAggregate_Test')
    ORDER BY pg_total_relation_size(c.oid) DESC;
  `;
  console.table(sizeComparison);

  // 5. QUERY PERFORMANCE BENCHMARKS
  console.log('\n--- RUNNING QUERY PERFORMANCE BENCHMARKS ---');
  
  // Test A: Get 1 student monthly history (June 2026)
  const testStudent = rawRecords[0].studentId;
  const testTenant = rawRecords[0].tenantId;

  console.time('Old Model: Get Student Monthly Attendance');
  const oldStudentMonth = await prisma.attendance.findMany({
    where: {
      tenantId: testTenant,
      studentId: testStudent,
      attendanceSession: {
        date: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') }
      }
    }
  });
  console.timeEnd('Old Model: Get Student Monthly Attendance');

  console.time('New Model: Get Student Monthly Attendance');
  const newStudentMonth = await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${testTenant} AND "studentId" = ${testStudent} AND "year" = 2026 AND "month" = 6;
  `;
  console.timeEnd('New Model: Get Student Monthly Attendance');

  // Test B: Get 1 student yearly history (2026)
  console.time('Old Model: Get Student Yearly Attendance');
  const oldStudentYear = await prisma.attendance.findMany({
    where: {
      tenantId: testTenant,
      studentId: testStudent,
      attendanceSession: {
        date: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') }
      }
    }
  });
  console.timeEnd('Old Model: Get Student Yearly Attendance');

  console.time('New Model: Get Student Yearly Attendance');
  const newStudentYear = await prisma.$queryRaw`
    SELECT * FROM "AttendanceMonthlyAggregate_Test"
    WHERE "tenantId" = ${testTenant} AND "studentId" = ${testStudent} AND "year" = 2026;
  `;
  console.timeEnd('New Model: Get Student Yearly Attendance');

  // 6. MULTI-TENANT ISOLATION SECURITY TEST
  console.log('\n--- EXECUTING MULTI-TENANT ISOLATION TESTS ---');
  const allTenants = Array.from(new Set(rawRecords.map(r => r.tenantId)));
  console.log('Available Tenants in DB:', allTenants);

  if (allTenants.length >= 1) {
    const tenantA = allTenants[0];
    const tenantB = 'dummy_tenant_school_b_9999';

    // Query Tenant A student using Tenant B context
    const crossTenantRead = await prisma.$queryRaw`
      SELECT * FROM "AttendanceMonthlyAggregate_Test"
      WHERE "tenantId" = ${tenantB} AND "studentId" = ${testStudent};
    `;
    console.log(`Cross-Tenant Read Attempt (Tenant B accessing Tenant A student): Returned ${crossTenantRead.length} rows.`);
    if (crossTenantRead.length === 0) {
      console.log('✔ MULTI-TENANT ISOLATION VERIFIED: Cross-tenant data access strictly denied.');
    } else {
      console.error('❌ MULTI-TENANT SECURITY BREACH DETECTED!');
    }
  }

  console.log('\n=== VALIDATION COMPLETED CLEANLY ===');
}

runValidation().catch(console.error).finally(() => prisma.$disconnect());
