-- Re-runnable form of 20261026_fabric_stock_import.sql (Fabric Store Excel stock import), which was never in
-- the migration runner's list and cannot be re-run as written. Same objects: two new tables, nullable
-- FabricInward columns, indexes and foreign keys. Additive only: no existing row is changed.
-- On a database where the original was applied by hand, every statement below is a no-op.
-- Apply with: node scripts/apply-appearance-migrations.js (production builds apply it automatically).

-- AlterTable
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "composition" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "importId" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "importRowNumber" INTEGER;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "purchaseOrderNumber" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "rollKey" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "rollNumber" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "shade" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "storageLocation" TEXT;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "unitRate" DOUBLE PRECISION;
ALTER TABLE "FabricInward" ADD COLUMN IF NOT EXISTS "width" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FabricStockImport" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "sheetsJson" TEXT NOT NULL,
    "selectedSheet" TEXT,
    "headerRow" INTEGER,
    "mappingJson" TEXT,
    "correctionsJson" TEXT,
    "resolutionsJson" TEXT,
    "validationJson" TEXT,
    "payloadHash" TEXT,
    "receiptNumber" TEXT,
    "confirmKey" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "postedResultJson" TEXT,
    "failureReason" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricStockImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FabricStockImportDocument" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sheetName" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "ocrStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricStockImportDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FabricStockImport_receiptNumber_key" ON "FabricStockImport"("receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "FabricStockImport_confirmKey_key" ON "FabricStockImport"("confirmKey");
CREATE INDEX IF NOT EXISTS "FabricStockImport_fileHash_idx" ON "FabricStockImport"("fileHash");
CREATE INDEX IF NOT EXISTS "FabricStockImport_status_idx" ON "FabricStockImport"("status");
CREATE INDEX IF NOT EXISTS "FabricStockImport_createdAt_idx" ON "FabricStockImport"("createdAt");
CREATE INDEX IF NOT EXISTS "FabricStockImportDocument_importId_idx" ON "FabricStockImportDocument"("importId");
CREATE UNIQUE INDEX IF NOT EXISTS "FabricInward_rollKey_key" ON "FabricInward"("rollKey");
CREATE INDEX IF NOT EXISTS "FabricInward_importId_idx" ON "FabricInward"("importId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricInward_importId_fkey') THEN
    ALTER TABLE "FabricInward" ADD CONSTRAINT "FabricInward_importId_fkey" FOREIGN KEY ("importId") REFERENCES "FabricStockImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricStockImport_postedById_fkey') THEN
    ALTER TABLE "FabricStockImport" ADD CONSTRAINT "FabricStockImport_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricStockImport_uploadedById_fkey') THEN
    ALTER TABLE "FabricStockImport" ADD CONSTRAINT "FabricStockImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricStockImportDocument_importId_fkey') THEN
    ALTER TABLE "FabricStockImportDocument" ADD CONSTRAINT "FabricStockImportDocument_importId_fkey" FOREIGN KEY ("importId") REFERENCES "FabricStockImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
