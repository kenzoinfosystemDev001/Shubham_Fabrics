-- Fabric photos taken along the line: Embroidery, Threadcut QC (QC2) and Stitching each add photos on their
-- own work lines; later departments on the route see them. A photo is never replaced by a later one.
-- The image bytes are kept in the database, like garment images.
-- Additive only: one new table. Re-runnable: every statement is skipped when its object already exists.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- CreateTable
CREATE TABLE IF NOT EXISTS "FabricPhoto" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "fabricName" TEXT,
    "colour" TEXT,
    "imageData" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FabricPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FabricPhoto_programId_idx" ON "FabricPhoto"("programId");
CREATE INDEX IF NOT EXISTS "FabricPhoto_workItemId_idx" ON "FabricPhoto"("workItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "FabricPhoto_workItemId_fileHash_key" ON "FabricPhoto"("workItemId", "fileHash");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricPhoto_programId_fkey') THEN
    ALTER TABLE "FabricPhoto" ADD CONSTRAINT "FabricPhoto_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricPhoto_workItemId_fkey') THEN
    ALTER TABLE "FabricPhoto" ADD CONSTRAINT "FabricPhoto_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "DepartmentWorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FabricPhoto_uploadedById_fkey') THEN
    ALTER TABLE "FabricPhoto" ADD CONSTRAINT "FabricPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
