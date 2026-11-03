-- REWORK and REJECT are QC decisions, not challan transfers. A REWORK decision is routed straight to the
-- configured rework department as a rework task (no challan); REJECT goes straight to the Defective Shelf.
-- Additive only: existing rows keep origin CHALLAN and nothing is moved or deleted. Safe to run more than once.

ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'CHALLAN';
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "reworkSourceItemId" TEXT;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "reworkReason" TEXT;
CREATE INDEX IF NOT EXISTS "DepartmentWorkItem_reworkSourceItemId_idx" ON "DepartmentWorkItem"("reworkSourceItemId");

ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'CHALLAN';
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "reworkChallanItemId" TEXT;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "reworkReason" TEXT;
