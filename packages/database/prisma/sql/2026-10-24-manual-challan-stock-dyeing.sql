-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN     "requiredDyeColor" TEXT,
ADD COLUMN     "requiredDyeQuantity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DyeingOrder" ADD COLUMN     "currentColor" TEXT,
ADD COLUMN     "inboundChallanItemId" TEXT;

-- AlterTable
ALTER TABLE "FabricInward" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "FabricOutward" ADD COLUMN     "color" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DyeingOrder_inboundChallanItemId_key" ON "DyeingOrder"("inboundChallanItemId");

-- CreateIndex
CREATE INDEX "DyeingOrder_inboundChallanId_idx" ON "DyeingOrder"("inboundChallanId");

