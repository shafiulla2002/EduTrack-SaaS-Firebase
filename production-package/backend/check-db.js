const { Client } = require("pg");
const c = new Client({
  connectionString: process.env.DATABASE_URL
});
(async () => {
  try {
    await c.connect();
    const migrations = await c.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at
    `);
    console.log("\n=== PRISMA MIGRATION HISTORY ===");
    console.table(migrations.rows);
    const tables = await c.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    console.log("\n=== DATABASE TABLES ===");
    console.table(tables.rows);
  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    await c.end();
  }
})();
