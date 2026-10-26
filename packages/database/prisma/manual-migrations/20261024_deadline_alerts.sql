-- Smart Deadline Alerts: additive only (two new tables, indexes, FKs). No existing table or row is changed.
-- Generated with: prisma migrate diff --from-schema-datamodel <main schema> --to-schema-datamodel prisma/schema.prisma --script
-- Apply with 'npm run db:push' (the project's usual flow) or by running this file. Re-runnable: every statement is skipped when its object already exists.
-- Also applied by: node scripts/apply-appearance-migrations.js

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeadlineAlert" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "programId" TEXT,
    "challanId" TEXT,
    "alertType" TEXT NOT NULL,
    "thresholdDays" INTEGER,
    "severity" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "deadlineDay" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "workStatus" TEXT NOT NULL,
    "taskLabel" TEXT NOT NULL,
    "productionSheetId" TEXT,
    "designNumber" TEXT,
    "challanNumber" TEXT,
    "recipientDepartments" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolvedReason" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeadlineAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeadlineAlertDismissal" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadlineAlertDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeadlineAlert_dedupKey_key" ON "DeadlineAlert"("dedupKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeadlineAlert_departmentCode_status_idx" ON "DeadlineAlert"("departmentCode", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeadlineAlert_entityType_entityId_status_idx" ON "DeadlineAlert"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeadlineAlert_programId_idx" ON "DeadlineAlert"("programId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeadlineAlert_challanId_idx" ON "DeadlineAlert"("challanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeadlineAlertDismissal_alertId_userId_idx" ON "DeadlineAlertDismissal"("alertId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeadlineAlertDismissal_userId_dismissedAt_idx" ON "DeadlineAlertDismissal"("userId", "dismissedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeadlineAlert_programId_fkey') THEN
    ALTER TABLE "DeadlineAlert" ADD CONSTRAINT "DeadlineAlert_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeadlineAlert_challanId_fkey') THEN
    ALTER TABLE "DeadlineAlert" ADD CONSTRAINT "DeadlineAlert_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeadlineAlertDismissal_alertId_fkey') THEN
    ALTER TABLE "DeadlineAlertDismissal" ADD CONSTRAINT "DeadlineAlertDismissal_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "DeadlineAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeadlineAlertDismissal_userId_fkey') THEN
    ALTER TABLE "DeadlineAlertDismissal" ADD CONSTRAINT "DeadlineAlertDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

