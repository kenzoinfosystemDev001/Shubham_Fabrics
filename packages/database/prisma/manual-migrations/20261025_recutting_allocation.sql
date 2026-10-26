-- Recutting: category / style allocations of received lines (TOP, BOTTOM, DUPATTA, OTHERS), the
-- allocation each Stitching challan line was issued from, and structured category / style columns
-- on challan items. Additive only: nullable columns and one new table; no existing row is changed.
-- Requires 20261025_department_work_items.sql. Re-runnable: every statement is skipped when its
-- object already exists.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "garmentCategory" TEXT;
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "styleRef" TEXT;
ALTER TABLE "DepartmentWorkTransfer" ADD COLUMN IF NOT EXISTS "allocationId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkItemAllocation" (
    "id" TEXT NOT NULL,
    "allocationNumber" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "otherName" TEXT,
    "styleRef" TEXT,
    "allocatedQuantity" DOUBLE PRECISION NOT NULL,
    "allocatedUom" TEXT NOT NULL,
    "cutQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cutUom" TEXT NOT NULL,
    "transferredQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItemAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkItemAllocation_allocationNumber_key" ON "WorkItemAllocation"("allocationNumber");
CREATE INDEX IF NOT EXISTS "WorkItemAllocation_workItemId_idx" ON "WorkItemAllocation"("workItemId");
CREATE INDEX IF NOT EXISTS "WorkItemAllocation_category_idx" ON "WorkItemAllocation"("category");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkItemAllocation_workItemId_fkey') THEN
    ALTER TABLE "WorkItemAllocation" ADD CONSTRAINT "WorkItemAllocation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "DepartmentWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkItemAllocation_createdById_fkey') THEN
    ALTER TABLE "WorkItemAllocation" ADD CONSTRAINT "WorkItemAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkTransfer_allocationId_fkey') THEN
    ALTER TABLE "DepartmentWorkTransfer" ADD CONSTRAINT "DepartmentWorkTransfer_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "WorkItemAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
