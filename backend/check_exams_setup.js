const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

  const examTypes = await prisma.examType.findMany({ where: { tenantId } });
  console.log('ExamTypes:', examTypes);

  const exams = await prisma.exam.findMany({ where: { tenantId } });
  console.log('Exams count:', exams.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
