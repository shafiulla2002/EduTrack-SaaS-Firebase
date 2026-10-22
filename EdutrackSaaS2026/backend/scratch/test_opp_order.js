const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runBaseline } = require('./test_financial_command_center_optimization.js');

async function testOrder() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const baseline = await runBaseline(tenantId);
  const activeYear = await prisma.academicYear.findFirst({ where: { tenantId, isActive: true } });
  const targetAYId = activeYear?.id || null;

  const rawOppsWithOrder = await prisma.$queryRaw`
    SELECT 
      o.id,
      o."studentId",
      o."classId",
      o."sectionId",
      o."closeDate",
      COALESCE(oli_agg."netFee", 0)::float AS "netFee",
      COALESCE(inv_agg."paid", 0)::float AS "paid",
      oli_agg."lineItems"
    FROM "Opportunity" o
    LEFT JOIN LATERAL (
      SELECT 
        SUM(oli."unitPrice" * oli."quantity" * (1 - oli."discount" / 100.0))::float AS "netFee",
        json_agg(json_build_object(
          'id', oli.id,
          'productName', p.name,
          'unitPrice', oli."unitPrice"::float,
          'quantity', oli."quantity"::float,
          'discount', oli."discount"::float
        ) ORDER BY oli.id ASC) AS "lineItems"
      FROM "OpportunityLineItem" oli
      LEFT JOIN "Product" p ON oli."productId" = p.id
      WHERE oli."opportunityId" = o.id
    ) oli_agg ON true
    LEFT JOIN LATERAL (
      SELECT 
        SUM(inv."paidAmount")::float AS "paid"
      FROM "Invoice" inv
      WHERE inv."opportunityId" = o.id
        AND inv."status" != 'VOIDED'
    ) inv_agg ON true
    WHERE o."tenantId" = ${tenantId}
      AND (${targetAYId}::text IS NULL OR o."academicYearId" = ${targetAYId})
    ORDER BY o.id ASC
  `;

  // Compare rawOpps order with Prisma activeOpps
  const prismaOpps = await prisma.opportunity.findMany({
    where: { tenantId, academicYearId: targetAYId || undefined },
    select: { id: true }
  });

  console.log('Prisma Opps Count:', prismaOpps.length);
  console.log('Raw Opps Count:', rawOppsWithOrder.length);
  
  let orderMatches = true;
  for (let i = 0; i < prismaOpps.length; i++) {
    if (prismaOpps[i].id !== rawOppsWithOrder[i].id) {
      orderMatches = false;
      console.log(`Mismatch at index ${i}: Prisma ${prismaOpps[i].id} vs Raw ${rawOppsWithOrder[i].id}`);
      break;
    }
  }
  console.log('Opportunity order matches Prisma findMany:', orderMatches);

  await prisma.$disconnect();
}

testOrder().catch(console.error);
