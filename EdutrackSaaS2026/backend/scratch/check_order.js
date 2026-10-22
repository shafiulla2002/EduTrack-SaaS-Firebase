const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPrismaLineOrder() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  
  const opps = await prisma.opportunity.findMany({
    where: { tenantId },
    select: { id: true, opportunityLineItems: { select: { id: true, product: { select: { name: true } } } } },
    take: 5
  });
  
  console.log('Prisma line items order for first opp:');
  for (const opp of opps) {
    if (opp.opportunityLineItems.length > 0) {
      console.log(opp.id, opp.opportunityLineItems.map(l => ({ id: l.id, name: l.product.name })));
      
      const rawNoOrder = await prisma.$queryRaw`
        SELECT oli.id, p.name AS "productName"
        FROM "OpportunityLineItem" oli
        JOIN "Product" p ON oli."productId" = p.id
        WHERE oli."tenantId" = ${tenantId} AND oli."opportunityId" = ${opp.id}
      `;
      console.log('Raw without order for first opp:', rawNoOrder);
      
      const rawOrderCTID = await prisma.$queryRaw`
        SELECT oli.id, p.name AS "productName"
        FROM "OpportunityLineItem" oli
        JOIN "Product" p ON oli."productId" = p.id
        WHERE oli."tenantId" = ${tenantId} AND oli."opportunityId" = ${opp.id}
        ORDER BY oli.ctid ASC
      `;
      console.log('Raw with ctid order for first opp:', rawOrderCTID);
      break;
    }
  }
  
  await prisma.$disconnect();
}

checkPrismaLineOrder().catch(console.error);
