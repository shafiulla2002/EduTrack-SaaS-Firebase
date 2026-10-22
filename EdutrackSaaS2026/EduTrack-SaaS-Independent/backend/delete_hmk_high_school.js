const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tenantId = 'f5749dae-fad1-4a8e-9237-df0dd2e39f59';
  try {
    // Delete tenant and cascade all related data
    await prisma.tenant.delete({
      where: { id: tenantId },
    });
    console.log(`Tenant ${tenantId} (HMK High School) deleted successfully.`);
  } catch (e) {
    console.error('Error deleting tenant:', e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
