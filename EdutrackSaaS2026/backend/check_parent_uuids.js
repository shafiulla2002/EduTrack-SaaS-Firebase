const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main() {
  console.log('Checking parent tables UUID validity...');

  const exams = await prisma.exam.findMany({ select: { id: true } });
  const students = await prisma.studentProfile.findMany({ select: { id: true } });
  const subjects = await prisma.subject.findMany({ select: { id: true } });
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  console.log(`Exams count: ${exams.length}`);
  console.log(`Students count: ${students.length}`);
  console.log(`Subjects count: ${subjects.length}`);
  console.log(`Tenants count: ${tenants.length}`);

  let invalidExams = exams.filter(e => !UUID_REGEX.test(e.id)).length;
  let invalidStudents = students.filter(s => !UUID_REGEX.test(s.id)).length;
  let invalidSubjects = subjects.filter(s => !UUID_REGEX.test(s.id)).length;
  let invalidTenants = tenants.filter(t => !UUID_REGEX.test(t.id)).length;

  console.log(`Invalid Exam UUIDs: ${invalidExams}`);
  console.log(`Invalid Student Profile UUIDs: ${invalidStudents}`);
  console.log(`Invalid Subject UUIDs: ${invalidSubjects}`);
  console.log(`Invalid Tenant UUIDs: ${invalidTenants}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
