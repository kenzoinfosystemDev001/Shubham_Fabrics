-- Production fixes: additive only (new nullable columns and two indexes). No existing row is changed;
-- historical challans, inward entries and ledger rows keep their values (new columns stay NULL).
-- Generated with: prisma migrate diff --from-schema-datamodel <feature/deadline-alerts schema> --to-schema-datamodel prisma/schema.prisma --script
-- Apply with: npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-migrations/20261024_production_fixes.sql
-- Requires approval for the shared Neon DB.

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN     "requiredColour" TEXT,
ADD COLUMN     "requiredQuantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockLedgerEntry" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "FabricInward" ADD COLUMN     "colour" TEXT;

-- AlterTable
ALTER TABLE "FabricOutward" ADD COLUMN     "colour" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockLedgerEntry_idempotencyKey_key" ON "StockLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_referenceType_referenceId_idx" ON "StockLedgerEntry"("referenceType", "referenceId");

