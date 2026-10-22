const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testExactOppQuery() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const activeYear = await prisma.academicYear.findFirst({ where: { tenantId, isActive: true } });
  const targetAYId = activeYear?.id || null;

  // Let's test two-step high performance query vs lateral join
  // Step 1: Opps
  const t0 = process.hrtime.bigint();
  const [opps, lineItems, oppInvoices] = await Promise.all([
    prisma.$queryRaw`
      SELECT id, "studentId", "classId", "sectionId", "closeDate"
      FROM "Opportunity"
      WHERE "tenantId" = ${tenantId}
        AND (${targetAYId}::text IS NULL OR "academicYearId" = ${targetAYId})
    `,
    prisma.$queryRaw`
      SELECT 
        oli."opportunityId",
        oli.id,
        p.name AS "productName",
        oli."unitPrice"::float AS "unitPrice",
        oli."quantity"::float AS "quantity",
        oli."discount"::float AS "discount"
      FROM "OpportunityLineItem" oli
      JOIN "Product" p ON oli."productId" = p.id
      WHERE oli."tenantId" = ${tenantId}
    `,
    prisma.$queryRaw`
      SELECT 
        "opportunityId",
        COALESCE(SUM("paidAmount"), 0)::float AS "paid"
      FROM "Invoice"
      WHERE "tenantId" = ${tenantId}
        AND "opportunityId" IS NOT NULL
        AND "status" != 'VOIDED'
      GROUP BY "opportunityId"
    `
  ]);

  const tEnd = process.hrtime.bigint();
  console.log(`Two-step query time: ${(Number(tEnd - t0) / 1e6).toFixed(2)} ms`);
  console.log(`Opps count: ${opps.length}, Line items count: ${lineItems.length}, Opp Invoices count: ${oppInvoices.length}`);

  // Let's check Prisma Opps order vs raw Opps order:
  const prismaOpps = await prisma.opportunity.findMany({
    where: { tenantId, academicYearId: targetAYId || undefined },
    select: { id: true }
  });

  let matchCount = 0;
  for (let i = 0; i < prismaOpps.length; i++) {
    if (prismaOpps[i].id === opps[i].id) matchCount++;
  }
  console.log(`Opportunity Order Match with Prisma findMany: ${matchCount}/${prismaOpps.length}`);

  await prisma.$disconnect();
}

testExactOppQuery().catch(console.error);
