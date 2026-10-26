-- AlterTable
ALTER TABLE "Challan" ADD COLUMN     "deliveryDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeadlineAlert" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "challanId" TEXT,
    "programId" TEXT,
    "assignedUserId" TEXT,
    "stage" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "deadlineSource" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

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
CREATE UNIQUE INDEX "DeadlineAlert_dedupeKey_key" ON "DeadlineAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "DeadlineAlert_departmentCode_status_idx" ON "DeadlineAlert"("departmentCode", "status");

-- CreateIndex
CREATE INDEX "DeadlineAlert_taskType_taskId_status_idx" ON "DeadlineAlert"("taskType", "taskId", "status");

-- CreateIndex
CREATE INDEX "DeadlineAlert_challanId_idx" ON "DeadlineAlert"("challanId");

-- CreateIndex
CREATE INDEX "DeadlineAlertDismissal_userId_dismissedAt_idx" ON "DeadlineAlertDismissal"("userId", "dismissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineAlertDismissal_alertId_userId_key" ON "DeadlineAlertDismissal"("alertId", "userId");

-- AddForeignKey
ALTER TABLE "DeadlineAlert" ADD CONSTRAINT "DeadlineAlert_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineAlert" ADD CONSTRAINT "DeadlineAlert_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineAlert" ADD CONSTRAINT "DeadlineAlert_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineAlertDismissal" ADD CONSTRAINT "DeadlineAlertDismissal_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "DeadlineAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeadlineAlertDismissal" ADD CONSTRAINT "DeadlineAlertDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
