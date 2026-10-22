const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runBaseline } = require('./test_financial_command_center_optimization.js');

async function debugCharts() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  console.log('Running Baseline...');
  const baseline = await runBaseline(tenantId);
  
  // Let's call the actual service method from billing.service.ts
  // or test_fcc_sql_strategy
  const { runOptimizedV3 } = require('./test_fcc_sql_strategy.js');
  console.log('Running Optimized V3...');
  const opt = await runOptimizedV3(tenantId);

  console.log('\n--- Comparing Charts subfields ---');
  for (const key of Object.keys(baseline.payload.charts)) {
    const bStr = JSON.stringify(baseline.payload.charts[key]);
    const oStr = JSON.stringify(opt.payload.charts[key]);
    if (bStr !== oStr) {
      console.error(`MISMATCH in charts.${key}:`);
      console.error(`  Baseline :`, JSON.stringify(baseline.payload.charts[key], null, 2).slice(0, 300));
      console.error(`  Optimized:`, JSON.stringify(opt.payload.charts[key], null, 2).slice(0, 300));
    } else {
      console.log(`  MATCH: charts.${key}`);
    }
  }

  await prisma.$disconnect();
}

debugCharts().catch(console.error);
