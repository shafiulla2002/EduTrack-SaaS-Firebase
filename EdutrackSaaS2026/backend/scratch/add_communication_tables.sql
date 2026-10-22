-- ============================================================================
-- TARGETED SCHEMA UPDATE: Add Communication Center to Restored Database
-- ============================================================================
-- This script ONLY creates 3 missing enums and 3 missing tables.
-- It does NOT modify, drop, or truncate any existing tables or data.
-- ============================================================================

-- ── Step 1: Create missing ENUM types ───────────────────────────────────────

CREATE TYPE "CommunicationType" AS ENUM (
  'ANNOUNCEMENT', 'NOTICE', 'CIRCULAR', 'EVENT',
  'MEETING', 'HOLIDAY', 'EMERGENCY', 'REMINDER'
);

CREATE TYPE "CommunicationPriority" AS ENUM (
  'LOW', 'MEDIUM', 'HIGH'
);

CREATE TYPE "CommunicationStatus" AS ENUM (
  'DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'CANCELLED'
);

-- ── Step 2: Create Communication table ──────────────────────────────────────

CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "priority" "CommunicationPriority" NOT NULL DEFAULT 'MEDIUM',
    "audienceGroups" TEXT[],
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- ── Step 3: Create CommunicationAttachment table ────────────────────────────

CREATE TABLE "CommunicationAttachment" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAttachment_pkey" PRIMARY KEY ("id")
);

-- ── Step 4: Create CommunicationRecipient table ─────────────────────────────

CREATE TABLE "CommunicationRecipient" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- ── Step 5: Create indexes (matching Prisma schema) ─────────────────────────

CREATE INDEX "Communication_tenantId_idx" ON "Communication"("tenantId");
CREATE INDEX "CommunicationAttachment_tenantId_idx" ON "CommunicationAttachment"("tenantId");
CREATE INDEX "CommunicationRecipient_tenantId_idx" ON "CommunicationRecipient"("tenantId");
CREATE INDEX "CommunicationRecipient_userId_idx" ON "CommunicationRecipient"("userId");

-- ── Step 6: Create foreign key constraints ──────────────────────────────────

-- Communication -> User (createdBy)
ALTER TABLE "Communication"
  ADD CONSTRAINT "Communication_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CommunicationAttachment -> Communication
ALTER TABLE "CommunicationAttachment"
  ADD CONSTRAINT "CommunicationAttachment_communicationId_fkey"
  FOREIGN KEY ("communicationId") REFERENCES "Communication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunicationRecipient -> Communication
ALTER TABLE "CommunicationRecipient"
  ADD CONSTRAINT "CommunicationRecipient_communicationId_fkey"
  FOREIGN KEY ("communicationId") REFERENCES "Communication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CommunicationRecipient -> User
ALTER TABLE "CommunicationRecipient"
  ADD CONSTRAINT "CommunicationRecipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- END OF SCRIPT
-- No existing tables were modified. No data was changed.
-- ============================================================================
