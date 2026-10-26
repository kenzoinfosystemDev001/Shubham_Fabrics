-- Dyeing workflow: receipt quantities, per-line orders, colour review and QC transfers.
-- Additive only: new nullable/defaulted columns on "DyeingOrder" and one new table. No existing row is changed.
-- Re-runnable: every statement is skipped when its object already exists.
-- Generated with: prisma migrate diff --from-schema-datamodel <previous schema> --to-schema-datamodel prisma/schema.prisma --script
-- (then made idempotent by hand).
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)
-- Requires approval for the shared Neon DB.

-- AlterTable
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "colorMismatch" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "colorReviewNote" TEXT;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "colorReviewedAt" TIMESTAMP(3);
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "colorReviewedById" TEXT;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "expectedCompletionDate" TIMESTAMP(3);
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "inboundChallanItemId" TEXT;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "receiptRemarks" TEXT;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "receivedById" TEXT;
ALTER TABLE "DyeingOrder" ADD COLUMN IF NOT EXISTS "receivedQuantity" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DyeingQcTransfer" (
    "id" TEXT NOT NULL,
    "dyeingOrderId" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "challanItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "uom" TEXT NOT NULL,
    "actualDyedColor" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DyeingQcTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DyeingQcTransfer_challanItemId_key" ON "DyeingQcTransfer"("challanItemId");
CREATE INDEX IF NOT EXISTS "DyeingQcTransfer_dyeingOrderId_idx" ON "DyeingQcTransfer"("dyeingOrderId");
CREATE INDEX IF NOT EXISTS "DyeingQcTransfer_challanId_idx" ON "DyeingQcTransfer"("challanId");
CREATE UNIQUE INDEX IF NOT EXISTS "DyeingOrder_inboundChallanItemId_key" ON "DyeingOrder"("inboundChallanItemId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DyeingOrder_receivedById_fkey') THEN
    ALTER TABLE "DyeingOrder" ADD CONSTRAINT "DyeingOrder_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DyeingOrder_colorReviewedById_fkey') THEN
    ALTER TABLE "DyeingOrder" ADD CONSTRAINT "DyeingOrder_colorReviewedById_fkey" FOREIGN KEY ("colorReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DyeingQcTransfer_dyeingOrderId_fkey') THEN
    ALTER TABLE "DyeingQcTransfer" ADD CONSTRAINT "DyeingQcTransfer_dyeingOrderId_fkey" FOREIGN KEY ("dyeingOrderId") REFERENCES "DyeingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DyeingQcTransfer_challanId_fkey') THEN
    ALTER TABLE "DyeingQcTransfer" ADD CONSTRAINT "DyeingQcTransfer_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "Challan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DyeingQcTransfer_createdById_fkey') THEN
    ALTER TABLE "DyeingQcTransfer" ADD CONSTRAINT "DyeingQcTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
