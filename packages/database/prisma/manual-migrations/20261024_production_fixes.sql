-- Production fixes: additive only (new nullable columns and two indexes). No existing row is changed;
-- historical challans, inward entries and ledger rows keep their values (new columns stay NULL).
-- Generated with: prisma migrate diff --from-schema-datamodel <feature/deadline-alerts schema> --to-schema-datamodel prisma/schema.prisma --script
-- Apply with: npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-migrations/20261024_production_fixes.sql
-- Re-runnable: every statement is skipped when its object already exists.
-- Also applied by: node scripts/apply-appearance-migrations.js

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "requiredColour" TEXT,
ADD COLUMN IF NOT EXISTS "requiredQuantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockLedgerEntry" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "colour" TEXT;

-- AlterTable
ALTER TABLE "FabricOutward" ADD COLUMN IF NOT EXISTS "colour" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StockLedgerEntry_idempotencyKey_key" ON "StockLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockLedgerEntry_referenceType_referenceId_idx" ON "StockLedgerEntry"("referenceType", "referenceId");

