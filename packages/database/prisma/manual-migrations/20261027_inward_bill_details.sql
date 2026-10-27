-- Inward Stock bill details from the Daily Stock Inwards Report: price per unit, box/than qty, HSN code,
-- tax % (per fabric line) and the biller's state / city. Additive only: new nullable columns; existing
-- entries simply have them empty. Re-runnable.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "billerStateCity" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "pricePerUnit" DOUBLE PRECISION;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "boxThanQty" DOUBLE PRECISION;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "hsnCode" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "taxPercent" DOUBLE PRECISION;
