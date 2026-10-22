const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const connInfo = await prisma.$queryRaw`
      SELECT count(*), state 
      FROM pg_stat_activity 
      GROUP BY state;
    `;
    console.log("Connection states count:", connInfo);

    const maxConns = await prisma.$queryRaw`
      SHOW max_connections;
    `;
    console.log("Max connections setting:", maxConns);

    const activeQueries = await prisma.$queryRaw`
      SELECT pid, state, query, age(clock_timestamp(), query_start)::text as duration
      FROM pg_stat_activity 
      WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY duration DESC
      LIMIT 10;
    `;
    console.log("Active non-idle queries:", activeQueries);

    const locks = await prisma.$queryRaw`
      SELECT pid, blocked_by, query
      FROM (
        SELECT a.pid,
               array_to_string(array_agg(distinct b.pid), ',') AS blocked_by,
               a.query
        FROM pg_catalog.pg_stat_activity a
        JOIN pg_catalog.pg_locks l1 ON a.pid = l1.pid AND NOT l1.granted
        JOIN pg_catalog.pg_locks l2 ON l1.relation = l2.relation AND l2.granted
        JOIN pg_catalog.pg_stat_activity b ON l2.pid = b.pid
        GROUP BY a.pid, a.query
      ) locks_list;
    `;
    console.log("Database Locks / Blocks:", locks);
  } catch (err) {
    console.error("Error querying PG status:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
