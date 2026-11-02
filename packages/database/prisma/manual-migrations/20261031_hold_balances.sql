-- HOLD blocks quantity: what a department keeps on HOLD can no longer be processed, inspected, allocated, packed
-- or sent on. Each line now carries its quantity still on HOLD ("heldQuantity"), kept in step with its open
-- DepartmentHold records by the app, so every quantity check reads it from the line itself.
-- Additive: one new column per table, default 0, then filled from the HOLDs open today. Re-runnable (the fill
-- recomputes the same figures).
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "heldQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "heldQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "DepartmentWorkItem" w
SET "heldQuantity" = COALESCE((
  SELECT SUM(h."remainingQuantity") FROM "DepartmentHold" h
  WHERE h."sourceType" = 'WORK_ITEM' AND h."sourceId" = w."id"
    AND h."status" IN ('ON_HOLD', 'PARTIALLY_RELEASED', 'PARTIALLY_FORWARDED')
), 0);

UPDATE "DyeingOrder" o
SET "heldQuantity" = COALESCE((
  SELECT SUM(h."remainingQuantity") FROM "DepartmentHold" h
  WHERE h."sourceType" = 'DYEING_ORDER' AND h."sourceId" = o."id"
    AND h."status" IN ('ON_HOLD', 'PARTIALLY_RELEASED', 'PARTIALLY_FORWARDED')
), 0);
