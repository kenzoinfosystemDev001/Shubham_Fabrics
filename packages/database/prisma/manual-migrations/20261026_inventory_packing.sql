-- Inventory Department: packing allocations of received finished garments, and complete-garment
-- images per Production Sheet + garment category (+ style). Additive only: two new tables; no
-- existing row is changed. Requires 20261025_department_work_items.sql. Re-runnable: every
-- statement is skipped when its object already exists.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- CreateTable
CREATE TABLE IF NOT EXISTS "PackingAllocation" (
    "id" TEXT NOT NULL,
    "packingNumber" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "packedQuantity" INTEGER NOT NULL DEFAULT 0,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SENT_FOR_PACKING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "packingDate" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GarmentImage" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "garmentCategory" TEXT NOT NULL,
    "styleRef" TEXT NOT NULL DEFAULT '',
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT,
    "imageUrl" TEXT,
    "imageData" BYTEA,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PackingAllocation_packingNumber_key" ON "PackingAllocation"("packingNumber");
CREATE INDEX IF NOT EXISTS "PackingAllocation_workItemId_idx" ON "PackingAllocation"("workItemId");
CREATE INDEX IF NOT EXISTS "PackingAllocation_status_idx" ON "PackingAllocation"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "GarmentImage_programId_garmentCategory_styleRef_key" ON "GarmentImage"("programId", "garmentCategory", "styleRef");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackingAllocation_workItemId_fkey') THEN
    ALTER TABLE "PackingAllocation" ADD CONSTRAINT "PackingAllocation_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "DepartmentWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackingAllocation_createdById_fkey') THEN
    ALTER TABLE "PackingAllocation" ADD CONSTRAINT "PackingAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GarmentImage_programId_fkey') THEN
    ALTER TABLE "GarmentImage" ADD CONSTRAINT "GarmentImage_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GarmentImage_uploadedById_fkey') THEN
    ALTER TABLE "GarmentImage" ADD CONSTRAINT "GarmentImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
