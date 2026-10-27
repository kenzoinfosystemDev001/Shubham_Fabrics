-- Fabric Store Excel stock import: additive only (two new tables, nullable FabricInward columns,
-- indexes, FKs). No existing row is changed.
-- Generated with: prisma migrate diff --from-schema-datamodel <feature/production-fixes schema> --to-schema-datamodel prisma/schema.prisma --script
-- Apply with: npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-migrations/20261026_fabric_stock_import.sql
-- Requires approval for the shared Neon DB.

-- AlterTable
ALTER TABLE "FabricInward" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "composition" TEXT,
ADD COLUMN     "importId" TEXT,
ADD COLUMN     "importRowNumber" INTEGER,
ADD COLUMN     "purchaseOrderNumber" TEXT,
ADD COLUMN     "rollKey" TEXT,
ADD COLUMN     "rollNumber" TEXT,
ADD COLUMN     "shade" TEXT,
ADD COLUMN     "storageLocation" TEXT,
ADD COLUMN     "unitRate" DOUBLE PRECISION,
ADD COLUMN     "width" TEXT;

-- CreateTable
CREATE TABLE "FabricStockImport" (
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
CREATE TABLE "FabricStockImportDocument" (
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
CREATE UNIQUE INDEX "FabricStockImport_receiptNumber_key" ON "FabricStockImport"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FabricStockImport_confirmKey_key" ON "FabricStockImport"("confirmKey");

-- CreateIndex
CREATE INDEX "FabricStockImport_fileHash_idx" ON "FabricStockImport"("fileHash");

-- CreateIndex
CREATE INDEX "FabricStockImport_status_idx" ON "FabricStockImport"("status");

-- CreateIndex
CREATE INDEX "FabricStockImport_createdAt_idx" ON "FabricStockImport"("createdAt");

-- CreateIndex
CREATE INDEX "FabricStockImportDocument_importId_idx" ON "FabricStockImportDocument"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "FabricInward_rollKey_key" ON "FabricInward"("rollKey");

-- CreateIndex
CREATE INDEX "FabricInward_importId_idx" ON "FabricInward"("importId");

-- AddForeignKey
ALTER TABLE "FabricInward" ADD CONSTRAINT "FabricInward_importId_fkey" FOREIGN KEY ("importId") REFERENCES "FabricStockImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricStockImport" ADD CONSTRAINT "FabricStockImport_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricStockImport" ADD CONSTRAINT "FabricStockImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricStockImportDocument" ADD CONSTRAINT "FabricStockImportDocument_importId_fkey" FOREIGN KEY ("importId") REFERENCES "FabricStockImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

