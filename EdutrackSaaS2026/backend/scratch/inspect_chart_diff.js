const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runBaseline } = require('./test_financial_command_center_optimization.js');

const { runOptimizedV4 } = require('./test_v4_parity.js');

async function testChartDiff() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const b = await runBaseline(tenantId, {});
  const o = await runOptimizedV4(tenantId, {});
  
  console.log('--- Chart Diffs ---');
  for (const [key, val] of Object.entries(b.payload.charts)) {
    const bJson = JSON.stringify(val);
    const oJson = JSON.stringify(o.payload.charts[key]);
    if (bJson !== oJson) {
      console.log(`MISMATCH in charts.${key}:`);
      console.log('Baseline:', bJson);
      console.log('Optimized:', oJson);
    } else {
      console.log(`MATCH in charts.${key}`);
    }
  }
  
  await prisma.$disconnect();
}

testChartDiff().catch(console.error);
