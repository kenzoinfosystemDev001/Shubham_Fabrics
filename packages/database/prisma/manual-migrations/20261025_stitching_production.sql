-- Stitching: garment category / style / source allocation on received lines, and the quantity taken
-- into production and found defective. Additive only: nullable or defaulted columns; no existing row
-- is changed. Requires 20261025_recutting_allocation.sql. Re-runnable.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- AlterTable
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "garmentCategory" TEXT;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "styleRef" TEXT;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "sourceAllocationId" TEXT;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "takenQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "defectQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkItem_sourceAllocationId_fkey') THEN
    ALTER TABLE "DepartmentWorkItem" ADD CONSTRAINT "DepartmentWorkItem_sourceAllocationId_fkey" FOREIGN KEY ("sourceAllocationId") REFERENCES "WorkItemAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
