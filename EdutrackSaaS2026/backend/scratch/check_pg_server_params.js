const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function inspectPgParams() {
  const maxConn = await prisma.$queryRaw`SHOW max_connections`;
  const activeConn = await prisma.$queryRaw`SELECT count(*)::int as count FROM pg_stat_activity`;
  const connsByApp = await prisma.$queryRaw`SELECT application_name, count(*)::int as count FROM pg_stat_activity GROUP BY application_name`;
  const dbSize = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;

  console.log('PostgreSQL Server Settings:');
  console.log('  max_connections:', maxConn);
  console.log('  active_connections:', activeConn);
  console.log('  conns_by_app:', connsByApp);
  console.log('  database_size:', dbSize);
}

inspectPgParams().catch(console.error).finally(() => prisma.$disconnect());
