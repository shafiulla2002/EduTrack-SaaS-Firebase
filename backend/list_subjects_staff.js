const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  const subjects = await prisma.subject.findMany({ where: { tenantId: TENANT_ID } });
  console.log('=== SUBJECTS ===');
  console.table(subjects.map(s => ({ id: s.id, name: s.name, code: s.code })));

  const staff = await prisma.staffProfile.findMany({
    where: { tenantId: TENANT_ID },
    include: { user: true }
  });
  console.log('\n=== STAFF PROFILES & SUBJECTS TAUGHT ===');
  console.table(staff.map(s => ({
    staffId: s.id,
    userId: s.userId,
    name: s.user?.name,
    role: s.user?.role,
    subjectsTaught: s.subjectsTaught.join(', ')
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
