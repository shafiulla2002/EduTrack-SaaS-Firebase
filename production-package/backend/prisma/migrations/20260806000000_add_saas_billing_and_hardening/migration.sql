-- 1. Ensure SubscriptionStatus Enum has all required values
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIAL';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'RENEWED';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- 2. Create SaaSPaymentStatus and SaaSInvoiceStatus Enums if they do not exist
DO $$ BEGIN
    CREATE TYPE "SaaSPaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SaaSInvoiceStatus" AS ENUM ('GENERATED', 'SENT', 'PAID', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create AuditLog Table if not exists
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- 4. Create PaymentSettings Table if not exists
CREATE TABLE IF NOT EXISTS "PaymentSettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'EduTrack Inc.',
    "companyLogoUrl" TEXT,
    "address" TEXT,
    "website" TEXT DEFAULT 'https://edutrack.com',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@edutrack.com',
    "supportPhone" TEXT DEFAULT '+91 9876543210',
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "gstPercentage" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-SUB-',
    "invoiceNumberFormat" TEXT NOT NULL DEFAULT 'INV-{YYYY}-{MM}-{NUMBER}',
    "footer" TEXT,
    "termsAndConditions" TEXT,
    "signatureImageUrl" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "branchName" TEXT,
    "upiId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- 5. Alter SubscriptionPlan columns if not exist
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "durationMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "priceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- 6. Alter TenantSubscription columns if not exist
ALTER TABLE "TenantSubscription" ADD COLUMN IF NOT EXISTS "gracePeriodEndDate" TIMESTAMP(3);

-- 7. Create SubscriptionBilling Table if not exists
CREATE TABLE IF NOT EXISTS "SubscriptionBilling" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "discountCents" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionBilling_pkey" PRIMARY KEY ("id")
);

-- 8. Alter SubscriptionInvoice safely
ALTER TABLE "SubscriptionInvoice" ADD COLUMN IF NOT EXISTS "downloadUrl" TEXT;
ALTER TABLE "SubscriptionInvoice" ADD COLUMN IF NOT EXISTS "snapshotData" JSONB;
ALTER TABLE "SubscriptionInvoice" ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SubscriptionInvoice" ALTER COLUMN "planId" DROP NOT NULL;

-- Safely cast SubscriptionInvoice.status from String to SaaSInvoiceStatus enum using USING clause
ALTER TABLE "SubscriptionInvoice" 
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SaaSInvoiceStatus" 
  USING (
    CASE "status"::text
      WHEN 'PAID' THEN 'PAID'::"SaaSInvoiceStatus"
      WHEN 'UNPAID' THEN 'GENERATED'::"SaaSInvoiceStatus"
      WHEN 'VOIDED' THEN 'CANCELLED'::"SaaSInvoiceStatus"
      WHEN 'SENT' THEN 'SENT'::"SaaSInvoiceStatus"
      WHEN 'GENERATED' THEN 'GENERATED'::"SaaSInvoiceStatus"
      WHEN 'CANCELLED' THEN 'CANCELLED'::"SaaSInvoiceStatus"
      ELSE 'GENERATED'::"SaaSInvoiceStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'GENERATED';

-- 9. Alter SubscriptionPayment safely
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "billingDurationMonths" INTEGER DEFAULT 12;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "method" TEXT DEFAULT 'RAZORPAY';
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "gatewayReference" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "signatureVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "gatewayResponse" JSONB;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "billingId" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;

ALTER TABLE "SubscriptionPayment" ALTER COLUMN "invoiceId" DROP NOT NULL;

-- Safely cast SubscriptionPayment.status from String to SaaSPaymentStatus enum using USING clause
ALTER TABLE "SubscriptionPayment" 
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SaaSPaymentStatus" 
  USING (
    CASE "status"::text
      WHEN 'SUCCESS' THEN 'SUCCESS'::"SaaSPaymentStatus"
      WHEN 'FAILED' THEN 'FAILED'::"SaaSPaymentStatus"
      WHEN 'REFUNDED' THEN 'REFUNDED'::"SaaSPaymentStatus"
      WHEN 'PENDING' THEN 'PENDING'::"SaaSPaymentStatus"
      ELSE 'PENDING'::"SaaSPaymentStatus"
    END
  ),
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 10. Add Foreign Keys safely
DO $$ BEGIN
    ALTER TABLE "SubscriptionBilling" ADD CONSTRAINT "SubscriptionBilling_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SubscriptionBilling" ADD CONSTRAINT "SubscriptionBilling_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "SubscriptionBilling"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 11. Create Performance Indexes safely
CREATE INDEX IF NOT EXISTS "AuditLog_performedBy_idx" ON "AuditLog"("performedBy");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE INDEX IF NOT EXISTS "TenantSubscription_tenantId_idx" ON "TenantSubscription"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantSubscription_status_idx" ON "TenantSubscription"("status");
CREATE INDEX IF NOT EXISTS "TenantSubscription_expiryDate_idx" ON "TenantSubscription"("expiryDate");

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionBilling_invoiceId_key" ON "SubscriptionBilling"("invoiceId");
CREATE INDEX IF NOT EXISTS "SubscriptionBilling_subscriptionId_idx" ON "SubscriptionBilling"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionBilling_invoiceId_idx" ON "SubscriptionBilling"("invoiceId");
CREATE INDEX IF NOT EXISTS "SubscriptionBilling_createdAt_idx" ON "SubscriptionBilling"("createdAt");

CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_tenantId_idx" ON "SubscriptionInvoice"("tenantId");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_invoiceNumber_idx" ON "SubscriptionInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_status_idx" ON "SubscriptionInvoice"("status");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_createdDate_idx" ON "SubscriptionInvoice"("createdDate");

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_eventId_key" ON "SubscriptionPayment"("eventId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_gatewayReference_idx" ON "SubscriptionPayment"("gatewayReference");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_eventId_idx" ON "SubscriptionPayment"("eventId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_createdAt_idx" ON "SubscriptionPayment"("createdAt");
