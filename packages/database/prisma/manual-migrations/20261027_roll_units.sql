-- Fabric Store roll receiving (GRN) in MTR or PCS: each roll keeps its own unit, and batch / receipt
-- totals keep meters and pieces apart. Additive only: new columns with defaults; existing rolls and ledger
-- entries were all recorded in meters, so they get MTR. Re-runnable.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

ALTER TABLE "FabricStoreRoll" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'MTR';
ALTER TABLE "FabricStockLedger" ADD COLUMN IF NOT EXISTS "uom" TEXT NOT NULL DEFAULT 'MTR';
ALTER TABLE "FabricBatch" ADD COLUMN IF NOT EXISTS "totalPieces" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "MaterialReceipt" ADD COLUMN IF NOT EXISTS "totalPiecesReceived" DECIMAL(10,2) NOT NULL DEFAULT 0;
