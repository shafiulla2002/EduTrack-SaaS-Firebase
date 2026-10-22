const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const queries = await prisma.$queryRaw`
      SELECT pid, state, query, age(clock_timestamp(), query_start) as duration, xact_start
      FROM pg_stat_activity 
      WHERE state IS NOT NULL
      ORDER BY duration DESC;
    `;
    console.log("All connection activities:", JSON.stringify(queries, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
