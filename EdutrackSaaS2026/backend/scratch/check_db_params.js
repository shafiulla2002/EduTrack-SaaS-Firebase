const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const idleTimeout = await prisma.$queryRaw`
      SHOW idle_in_transaction_session_timeout;
    `;
    console.log("idle_in_transaction_session_timeout:", idleTimeout);

    const idleSessionTimeout = await prisma.$queryRaw`
      SHOW idle_session_timeout;
    `;
    console.log("idle_session_timeout:", idleSessionTimeout);

    const checkLock = await prisma.$queryRaw`
      SELECT pid, query, state, age(clock_timestamp(), query_start) as duration
      FROM pg_stat_activity 
      WHERE state != 'idle';
    `;
    console.log("Current active queries:", checkLock);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
