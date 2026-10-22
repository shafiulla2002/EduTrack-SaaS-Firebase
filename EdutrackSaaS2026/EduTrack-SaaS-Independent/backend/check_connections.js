const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.$queryRaw`SELECT count(*)::int FROM pg_stat_activity;`;
    console.log("Active Database Connections:", res[0].count);
    
    const details = await prisma.$queryRaw`SELECT pid, usename, client_addr, state, query FROM pg_stat_activity;`;
    console.log("Details:", details);
  } catch (err) {
    console.error("Error querying connections:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
