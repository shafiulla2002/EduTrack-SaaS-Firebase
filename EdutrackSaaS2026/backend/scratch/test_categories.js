const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runBaseline } = require('./test_financial_command_center_optimization.js');

async function testCategories() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const baseline = await runBaseline(tenantId);
  
  console.log('Baseline feeCategoryAnalysis:');
  console.log(JSON.stringify(baseline.payload.charts.feeCategoryAnalysis, null, 2));

  console.log('\nAll Products in tenant:');
  const products = await prisma.product.findMany({
    where: { tenantId },
    select: { id: true, name: true }
  });
  console.log(products);

  await prisma.$disconnect();
}

testCategories().catch(console.error);
