-- Department work items: the previous department's line each line was issued from (e.g. the Stitching
-- line a Finishing line came from), for traceability across departments. Additive only: one nullable
-- column; no existing row is changed. Requires 20261025_department_work_items.sql. Re-runnable.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- AlterTable
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "sourceWorkItemId" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentWorkItem_sourceWorkItemId_fkey') THEN
    ALTER TABLE "DepartmentWorkItem" ADD CONSTRAINT "DepartmentWorkItem_sourceWorkItemId_fkey" FOREIGN KEY ("sourceWorkItemId") REFERENCES "DepartmentWorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
