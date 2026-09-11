const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
  console.log('Available Models:', models);

  const stats = {};
  for (const m of models) {
    try {
      if (prisma[m] && typeof prisma[m].count === 'function') {
        const count = await prisma[m].count({ where: { tenantId: SHAFIULLA_TENANT_ID } }).catch(() => null);
        if (count !== null) {
          stats[m] = count;
        } else {
          // try count without tenantId filter or count all
          const totalCount = await prisma[m].count().catch(() => 0);
          stats[`${m}_total`] = totalCount;
        }
      }
    } catch (e) {
      // skip
    }
  }
  console.log('--- SHAFIULLA TENANT STATS ---');
  console.log(stats);
}

main().catch(console.error).finally(() => prisma.$disconnect());
