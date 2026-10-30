-- Shrinkage of dyed fabric: one record per line of a Dyeing -> Dyeing QC challan, entered by Dyeing QC
-- (with the inspection, or on the Shrinkage screen) and shown read-only in the Fabric Store.
-- Information only: Fabric Store stock is not changed by it.
-- Additive only: one new table. Re-runnable: every statement is skipped when its object already exists.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- CreateTable
CREATE TABLE IF NOT EXISTS "ShrinkageRecord" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "challanItemId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "originalQty" DOUBLE PRECISION NOT NULL,
    "originalUnit" TEXT NOT NULL,
    "shrinkageQty" DOUBLE PRECISION NOT NULL,
    "shrinkageUnit" TEXT NOT NULL,
    "remainingQty" DOUBLE PRECISION,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShrinkageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ShrinkageRecord_challanItemId_key" ON "ShrinkageRecord"("challanItemId");
CREATE INDEX IF NOT EXISTS "ShrinkageRecord_programId_idx" ON "ShrinkageRecord"("programId");
CREATE INDEX IF NOT EXISTS "ShrinkageRecord_challanId_idx" ON "ShrinkageRecord"("challanId");
CREATE INDEX IF NOT EXISTS "ShrinkageRecord_updatedAt_idx" ON "ShrinkageRecord"("updatedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_challanId_fkey') THEN
    ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_challanItemId_fkey') THEN
    ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_challanItemId_fkey" FOREIGN KEY ("challanItemId") REFERENCES "ChallanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_programId_fkey') THEN
    ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_createdById_fkey') THEN
    ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShrinkageRecord_updatedById_fkey') THEN
    ALTER TABLE "ShrinkageRecord" ADD CONSTRAINT "ShrinkageRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
