const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const studentCount = await prisma.studentProfile.count();
    console.log("Current StudentProfile count in DB:", studentCount);

    const invoiceCount = await prisma.invoice.count();
    console.log("Current Invoice count in DB:", invoiceCount);

    const parentCount = await prisma.parentProfile.count();
    console.log("Current ParentProfile count in DB:", parentCount);
  } catch (err) {
    console.error("Error checking counts:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
