const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying safe, non-destructive Razorpay columns to Tenant and Invoice...');
  
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "razorpayEnabled" BOOLEAN DEFAULT false;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "razorpayIsTestMode" BOOLEAN DEFAULT true;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "razorpayKeyId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "razorpayKeySecret" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "razorpayWebhookSecret" TEXT;`);
  
  await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "razorpaySignature" TEXT;`);

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'RAZORPAY';`);
  } catch (e) {
    console.log('Enum note (might already exist or managed):', e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invoice_razorpayPaymentId_idx" ON "Invoice"("razorpayPaymentId");`);
  } catch (e) {
    console.log('Index note:', e.message);
  }

  console.log('Safe migration columns and indexes applied successfully!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Migration failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
