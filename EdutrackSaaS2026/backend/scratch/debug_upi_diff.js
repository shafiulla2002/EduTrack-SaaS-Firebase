const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { runBaseline } = require('./test_financial_command_center_optimization.js');
const { runOptimizedV3 } = require('./test_fcc_sql_strategy.js');

async function debugUpi() {
  const tenantId = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';
  const filters = { paymentMethod: 'UPI' };

  const baseline = await runBaseline(tenantId, filters);
  const opt = await runOptimizedV3(tenantId, filters);

  for (const k of Object.keys(baseline.payload)) {
    const bStr = JSON.stringify(baseline.payload[k]);
    const oStr = JSON.stringify(opt.payload[k]);
    if (bStr !== oStr) {
      console.error(`MISMATCH in field: "${k}"`);
      if (typeof baseline.payload[k] === 'object' && baseline.payload[k] !== null) {
        for (const subk of Object.keys(baseline.payload[k])) {
          const bsStr = JSON.stringify(baseline.payload[k][subk]);
          const osStr = JSON.stringify(opt.payload[k][subk]);
          if (bsStr !== osStr) {
            console.error(`  Subfield mismatch "${k}.${subk}":`);
            console.error(`    Baseline :`, bsStr.slice(0, 200));
            console.error(`    Optimized:`, osStr.slice(0, 200));
          }
        }
      }
    }
  }

  await prisma.$disconnect();
}

debugUpi().catch(console.error);
