const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Connecting to database and fetching support requests...");
  const reqs = await prisma.supportRequest.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Found ${reqs.length} support requests:`);
  console.log(JSON.stringify(reqs, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
