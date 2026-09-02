const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://edutrack_app:edutrack%402026@34.180.7.94:5432/edutrack",
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');

    const res = await client.query(`
      SELECT pid, usename, client_addr, state, query_start 
      FROM pg_stat_activity 
      WHERE datname = 'edutrack';
    `);
    console.log(`Active connections count: ${res.rows.length}`);
    console.table(res.rows.map(r => ({ pid: r.pid, usename: r.usename, state: r.state, client_addr: r.client_addr })));

    // Kill idle connections
    const killRes = await client.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = 'edutrack' 
        AND pid <> pg_backend_pid();
    `);
    console.log(`Terminated ${killRes.rows.length} connections.`);
  } catch (err) {
    console.error('Error terminating idle connections:', err);
  } finally {
    await client.end();
  }
}

main();
