// Safe SQL runner that strips comments and executes queries
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();
  const sqlPath = path.join(__dirname, 'add_communication_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('=== RUNNING TARGETED SCHEMA UPDATE ===');
  console.log('Connecting to:', process.env.DATABASE_URL);

  // Strip single-line comments (-- ...) and block comments (/* ... */)
  const cleanSql = sql
    .replace(/--.*$/gm, '') // remove -- comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // remove /* */ comments

  // Split by semicolon and clean up
  const statements = cleanSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  for (let stmt of statements) {
    console.log(`Executing:\n${stmt}\n`);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('SUCCESS');
    } catch (err) {
      console.error('ERROR:', err.message);
      // If type already exists or table already exists, continue.
      if (err.message.includes('already exists') || err.message.includes('already defined')) {
        console.log('Continuing...');
      } else {
        throw err;
      }
    }
  }

  console.log('=== SCHEMA UPDATE COMPLETE ===');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
