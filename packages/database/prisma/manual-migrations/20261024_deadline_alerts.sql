-- Smart Deadline Alerts: additive only (two new tables, indexes, FKs). No existing table or row is changed.
-- Generated with: prisma migrate diff --from-schema-datamodel <main schema> --to-schema-datamodel prisma/schema.prisma --script
-- Apply with 'npm run db:push' (the project's usual flow) or by running this file. Requires approval for the shared Neon DB.

-- CreateTable
CREATE TABLE "DeadlineAlert" (
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
CREATE TABLE "DeadlineAlertDismissal" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadlineAlertDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineAlert_dedupKey_key" ON "DeadlineAlert"("dedupKey");

-- CreateIndex
CREATE INDEX "DeadlineAlert_departmentCode_status_idx" ON "DeadlineAlert"("departmentCode", "status");

-- CreateIndex
CREATE INDEX "DeadlineAlert_entityType_entityId_status_idx" ON "DeadlineAlert"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "DeadlineAlert_programId_idx" ON "DeadlineAlert"("programId");

-- CreateIndex
CREATE INDEX "DeadlineAlert_challanId_idx" ON "DeadlineAlert"("challanId");

-- CreateIndex
CREATE INDEX "DeadlineAlertDismissal_alertId_userId_idx" ON "DeadlineAlertDismissal"("alertId", "userId");

-- CreateIndex
CREATE INDEX "DeadlineAlertDismissal_userId_dismissedAt_idx" ON "DeadlineAlertDismissal"("userId", "dismissedAt");

-- AddForeignKey
ALTER TABLE "DeadlineAlert" ADD CONSTRAINT "DeadlineAlert_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineAlert" ADD CONSTRAINT "DeadlineAlert_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineAlertDismissal" ADD CONSTRAINT "DeadlineAlertDismissal_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "DeadlineAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineAlertDismissal" ADD CONSTRAINT "DeadlineAlertDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

