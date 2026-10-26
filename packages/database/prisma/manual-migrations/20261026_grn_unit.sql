-- GRN unit: a Material Receipt can be logged in MTR or PCS. Additive only.
-- Every existing batch was measured in meters, so the 'MTR' default fills old rows correctly.
-- Apply with: npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-migrations/20261026_grn_unit.sql
-- Requires approval for the shared Neon DB.

-- AlterTable
ALTER TABLE "FabricBatch" ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'MTR';
