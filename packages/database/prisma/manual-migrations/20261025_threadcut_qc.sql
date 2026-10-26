-- Threadcut QC (department code QC2) on department work items: per-line inspection batches with
-- PASS / REJECT / REWORK quantities, and the outcome each outgoing transfer carries.
-- Additive only: new columns with defaults, one new table, and the QC2 department's display name.
-- Requires 20261025_department_work_items.sql. Re-runnable: every statement is skipped when its
-- object already exists.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- AlterTable
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "passedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "rejectedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "reworkQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "rejectSentQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "reworkSentQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DepartmentWorkTransfer" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'PASS';

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkItemInspection" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "inspectedQuantity" DOUBLE PRECISION NOT NULL,
    "passQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rejectQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reworkQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL,
    "rejectReason" TEXT,
    "reworkReason" TEXT,
    "remarks" TEXT,
    "inspectorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItemInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkItemInspection_workItemId_idx" ON "WorkItemInspection"("workItemId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkItemInspection_workItemId_fkey') THEN
    ALTER TABLE "WorkItemInspection" ADD CONSTRAINT "WorkItemInspection_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "DepartmentWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkItemInspection_inspectorId_fkey') THEN
    ALTER TABLE "WorkItemInspection" ADD CONSTRAINT "WorkItemInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Display name: QC2 is Threadcut QC (the code stays QC2 so history and permissions keep working).
UPDATE "Department" SET "name" = 'Threadcut QC' WHERE "code" = 'QC2' AND "name" <> 'Threadcut QC';
-- Same for QC3: Washing QC (the code stays QC3).
UPDATE "Department" SET "name" = 'Washing QC' WHERE "code" = 'QC3' AND "name" <> 'Washing QC';
