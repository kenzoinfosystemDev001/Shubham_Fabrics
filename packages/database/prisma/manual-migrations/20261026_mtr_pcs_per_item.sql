-- MTR / PCS per item. Additive only: no existing row changes meaning.
-- - Challan.defectiveUnit: the unit of defectivePieces. A challan whose lines are in both units has
--   fabricUnit 'MIXED', so the defective quantity needs its own unit. Older rows stay NULL and keep
--   using fabricUnit.
-- - DefectRecord.uom: the unit of the defect quantity (older rows stay NULL).
-- - DefectRecord.quantity INTEGER -> DOUBLE PRECISION, so meter defects such as 2.5 MTR are not rounded.
--   Widening keeps every existing value exactly.
-- Apply with: npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-migrations/20261026_mtr_pcs_per_item.sql
-- Re-runnable (IF NOT EXISTS; widening an already DOUBLE PRECISION column is a no-op).
-- Requires approval for the shared Neon DB.

-- AlterTable
ALTER TABLE "Challan" ADD COLUMN IF NOT EXISTS "defectiveUnit" TEXT;

-- AlterTable
ALTER TABLE "DefectRecord" ADD COLUMN IF NOT EXISTS "uom" TEXT,
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;
