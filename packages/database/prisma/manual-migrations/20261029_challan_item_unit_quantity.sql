-- Challan line Unit quantity: the Items section of challans from Programming to Recutting reads
-- Size | Average | Unit | Remarks, and Unit is a quantity with its own MTR / PCS unit, like Average.
-- Information only: stock and forwarding keep using the line's quantity / uom (the Size).
-- Additive only: existing lines keep NULL, nothing else changes.
-- Re-runnable (IF NOT EXISTS).

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "unitQuantity" DOUBLE PRECISION;
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "unitQuantityUom" TEXT;
