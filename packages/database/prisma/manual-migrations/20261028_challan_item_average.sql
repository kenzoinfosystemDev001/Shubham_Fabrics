-- Challan line Average: an optional number entered with each challan entry (Size | Unit | Average | Remarks),
-- with its own MTR / PCS unit.
-- Additive only: existing lines keep NULL, nothing else changes.
-- Re-runnable (IF NOT EXISTS).

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "average" DOUBLE PRECISION;
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "averageUnit" TEXT;
