-- Fabric Store "Upload Stock Sheet": one row per uploaded photo, scan or Excel file. Keeps the original
-- file, what was read from it, who uploaded and who confirmed it, and which inward rows it created, so
-- every import can be audited. Nothing is written to stock until a user confirms the reviewed rows.
-- Additive only: one new table; no existing row is changed. Re-runnable.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

CREATE TABLE IF NOT EXISTS "StockImport" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
    "extractedJson" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "engine" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmKey" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedJson" JSONB,
    "resultJson" JSONB,
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockImport_confirmKey_key" ON "StockImport"("confirmKey");
CREATE INDEX IF NOT EXISTS "StockImport_fileHash_idx" ON "StockImport"("fileHash");
CREATE INDEX IF NOT EXISTS "StockImport_uploadedAt_idx" ON "StockImport"("uploadedAt");
