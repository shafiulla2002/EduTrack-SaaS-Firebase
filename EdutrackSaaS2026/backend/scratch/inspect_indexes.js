const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function inspectIndexes() {
  const studentIndexes = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'StudentProfile';
  `;
  console.log('StudentProfile Indexes:');
  studentIndexes.forEach(idx => console.log('  *', idx.indexname, ':', idx.indexdef));

  const userIndexes = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'User';
  `;
  console.log('\nUser Indexes:');
  userIndexes.forEach(idx => console.log('  *', idx.indexname, ':', idx.indexdef));
}

inspectIndexes().catch(console.error).finally(() => prisma.$disconnect());
