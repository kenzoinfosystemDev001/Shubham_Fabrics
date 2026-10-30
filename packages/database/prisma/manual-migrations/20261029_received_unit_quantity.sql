-- Receiving in MTR and PCS: a challan line carries its quantity in one unit and may carry its Unit quantity in the
-- other. Receiving screens record what arrived in each unit separately; these columns keep the second one for
-- work lines (Embroidery to Inventory) and dyeing orders. Never converted.
-- Additive only: nullable columns. Re-runnable: skipped when they already exist.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "receivedUnitQuantity" DOUBLE PRECISION;
ALTER TABLE "DepartmentWorkItem" ADD COLUMN IF NOT EXISTS "receivedUnitQuantityUom" TEXT;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "receivedUnitQuantity" DOUBLE PRECISION;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "receivedUnitQuantityUom" TEXT;
