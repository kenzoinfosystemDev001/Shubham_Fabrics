-- Department work items (Embroidery now, Thread Cutting and later departments next) and per-line fabric
-- processing status. Additive only: one new nullable column on "ChallanItem" and two new tables.
-- No existing row is changed. Re-runnable: every statement is skipped when its object already exists.
-- Generated with: prisma migrate diff --from-schema-datamodel <previous schema> --to-schema-datamodel prisma/schema.prisma --script
-- (then made idempotent by hand).
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)
-- Requires approval for the shared Neon DB.

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "fabricProcessingStatus" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DepartmentWorkItem" (
    "id" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "inboundChallanId" TEXT NOT NULL,
    "inboundChallanItemId" TEXT NOT NULL,
    "sourceDepartment" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "colour" TEXT,
    "fabricProcessingStatus" TEXT NOT NULL,
    "fabricStatusSource" TEXT NOT NULL DEFAULT 'ROUTE',
    "status" TEXT NOT NULL DEFAULT 'AWAITING_RECEIPT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "uom" TEXT NOT NULL,
    "expectedQuantity" DOUBLE PRECISION NOT NULL,
    "receivedQuantity" DOUBLE PRECISION,
    "processedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferredQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "receiptRemarks" TEXT,
    "expectedCompletionDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastTransferredAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DepartmentWorkTransfer" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "challanItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "fabricProcessingStatus" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentWorkTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentWorkItem_itemNumber_key" ON "DepartmentWorkItem"("itemNumber");
CREATE INDEX IF NOT EXISTS "DepartmentWorkItem_departmentCode_status_idx" ON "DepartmentWorkItem"("departmentCode", "status");
CREATE INDEX IF NOT EXISTS "DepartmentWorkItem_programId_idx" ON "DepartmentWorkItem"("programId");
CREATE INDEX IF NOT EXISTS "DepartmentWorkItem_inboundChallanId_idx" ON "DepartmentWorkItem"("inboundChallanId");
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentWorkItem_departmentCode_inboundChallanItemId_key" ON "DepartmentWorkItem"("departmentCode", "inboundChallanItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentWorkTransfer_challanItemId_key" ON "DepartmentWorkTransfer"("challanItemId");
CREATE INDEX IF NOT EXISTS "DepartmentWorkTransfer_workItemId_idx" ON "DepartmentWorkTransfer"("workItemId");
CREATE INDEX IF NOT EXISTS "DepartmentWorkTransfer_challanId_idx" ON "DepartmentWorkTransfer"("challanId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkItem_programId_fkey') THEN
    ALTER TABLE "DepartmentWorkItem" ADD CONSTRAINT "DepartmentWorkItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkItem_inboundChallanId_fkey') THEN
    ALTER TABLE "DepartmentWorkItem" ADD CONSTRAINT "DepartmentWorkItem_inboundChallanId_fkey" FOREIGN KEY ("inboundChallanId") REFERENCES "Challan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkItem_receivedById_fkey') THEN
    ALTER TABLE "DepartmentWorkItem" ADD CONSTRAINT "DepartmentWorkItem_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkTransfer_workItemId_fkey') THEN
    ALTER TABLE "DepartmentWorkTransfer" ADD CONSTRAINT "DepartmentWorkTransfer_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "DepartmentWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkTransfer_challanId_fkey') THEN
    ALTER TABLE "DepartmentWorkTransfer" ADD CONSTRAINT "DepartmentWorkTransfer_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkTransfer_createdById_fkey') THEN
    ALTER TABLE "DepartmentWorkTransfer" ADD CONSTRAINT "DepartmentWorkTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
