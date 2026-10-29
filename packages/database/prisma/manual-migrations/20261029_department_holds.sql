-- HOLD records in the production departments, Dyeing to Inventory (Packing): the quantity of a received line a
-- department keeps back, with its reason, and the history of releases. Forwarding is read from the existing
-- transfer records, so no existing table changes.
-- Additive only: two new tables. Re-runnable: every statement is skipped when its object already exists.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- CreateTable
CREATE TABLE IF NOT EXISTS "DepartmentHold" (
    "id" TEXT NOT NULL,
    "holdNumber" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "activeKey" TEXT,
    "programId" TEXT NOT NULL,
    "challanId" TEXT,
    "challanNumber" TEXT,
    "designNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "productionSheetNumber" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "colour" TEXT,
    "size" TEXT,
    "unit" TEXT NOT NULL,
    "receivedQuantity" DOUBLE PRECISION NOT NULL,
    "forwardedQuantity" DOUBLE PRECISION NOT NULL,
    "forwardedAtHold" DOUBLE PRECISION NOT NULL,
    "holdQuantity" DOUBLE PRECISION NOT NULL,
    "releasedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingQuantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonOther" TEXT,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ON_HOLD',
    "heldById" TEXT,
    "heldByName" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentHold_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DepartmentHoldEvent" (
    "id" TEXT NOT NULL,
    "holdId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "remainingAfter" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "remarks" TEXT,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentHoldEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentHold_holdNumber_key" ON "DepartmentHold"("holdNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentHold_activeKey_key" ON "DepartmentHold"("activeKey");
CREATE INDEX IF NOT EXISTS "DepartmentHold_departmentCode_status_idx" ON "DepartmentHold"("departmentCode", "status");
CREATE INDEX IF NOT EXISTS "DepartmentHold_programId_idx" ON "DepartmentHold"("programId");
CREATE INDEX IF NOT EXISTS "DepartmentHold_sourceKey_idx" ON "DepartmentHold"("sourceKey");
CREATE INDEX IF NOT EXISTS "DepartmentHoldEvent_holdId_idx" ON "DepartmentHoldEvent"("holdId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHold_programId_fkey') THEN
    ALTER TABLE "DepartmentHold" ADD CONSTRAINT "DepartmentHold_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHold_heldById_fkey') THEN
    ALTER TABLE "DepartmentHold" ADD CONSTRAINT "DepartmentHold_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHoldEvent_holdId_fkey') THEN
    ALTER TABLE "DepartmentHoldEvent" ADD CONSTRAINT "DepartmentHoldEvent_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "DepartmentHold"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHoldEvent_actorId_fkey') THEN
    ALTER TABLE "DepartmentHoldEvent" ADD CONSTRAINT "DepartmentHoldEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
