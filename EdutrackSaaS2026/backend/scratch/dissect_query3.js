const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
});

async function dissectQuery3() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const sampleClassSection = await prisma.classSection.findFirst({
    where: { tenantId },
    include: { class: true, section: true }
  });
  const classSectionId = sampleClassSection.id;

  const capturedQueries = [];
  prisma.$on('query', (e) => {
    capturedQueries.push({
      query: e.query,
      params: e.params,
      duration: e.duration,
      timestamp: performance.now()
    });
  });

  console.log('--- DISSECTING ClassSection.findUnique ---');
  const t0 = performance.now();
  const res = await prisma.classSection.findUnique({
    where: { id: classSectionId },
    include: {
      class: true,
      section: true,
      classSubjects: {
        include: { subject: true },
        orderBy: { subject: { name: 'asc' } },
      },
      teacherAssigns: {
        include: { teacher: { include: { user: true } }, subject: true },
      },
    },
  });
  const t1 = performance.now();

  console.log(`Total findUnique call: ${(t1 - t0).toFixed(2)} ms`);
  console.log(`Prisma generated ${capturedQueries.length} separate SQL queries:`);
  capturedQueries.forEach((q, idx) => {
    console.log(`\n[SQL Sub-query ${idx + 1}] (Duration reported by Prisma: ${q.duration} ms)`);
    console.log(`SQL: ${q.query}`);
    console.log(`Params: ${q.params}`);
  });

  await prisma.$disconnect();
}

dissectQuery3().catch(console.error);
