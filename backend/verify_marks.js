const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  const marksCount = await prisma.examMark.count({
    where: { tenantId: TENANT_ID }
  });

  const examsCount = await prisma.exam.count({
    where: { tenantId: TENANT_ID }
  });

  console.log(`Verification: Shafiulla High School has ${examsCount} Exams and ${marksCount} Exam Marks stored in database.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
