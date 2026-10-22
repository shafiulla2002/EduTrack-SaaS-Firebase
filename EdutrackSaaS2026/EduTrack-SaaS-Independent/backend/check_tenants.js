const { PrismaClient } = require('@prisma/client');
async function main() {
  const p = new PrismaClient();
  try {
    const tenants = await p.tenant.findMany({ select: { id: true, name: true, subDomain: true } });
    console.log(JSON.stringify(tenants, null, 2));
  } finally {
    await p.$disconnect();
  }
}
main().catch(console.error);
