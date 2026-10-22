const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function printIndexes() {
  const targetTables = [
    'Period', 'ClassSection', 'ClassSubject', 'TeacherAssignment',
    'PeriodTiming', 'TimetableConfig', 'Subject', 'StaffProfile',
    'TeacherSkill', 'User', 'Class', 'Section', 'AcademicYear'
  ];

  const existingIndexes = await prisma.$queryRawUnsafe(`
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (${targetTables.map(t => `'${t}'`).join(',')})
    ORDER BY tablename, indexname;
  `);

  console.log('TABLE | INDEX | DEFINITION');
  console.log('--------------------------------------------------------------------------------');
  existingIndexes.forEach(idx => {
    console.log(`${idx.tablename} | ${idx.indexname} | ${idx.indexdef}`);
  });

  await prisma.$disconnect();
}

printIndexes().catch(console.error);
