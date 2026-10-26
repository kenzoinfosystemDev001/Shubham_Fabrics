-- Department sidebar images: additive only (one new table, two indexes, two foreign keys). No existing row is changed.
-- One row per department (unique departmentId). Files go to Cloudinary when configured, otherwise into "imageData" (BYTEA).
-- Re-runnable: every statement is skipped when its object already exists.
-- Generated with: prisma migrate diff --from-schema-datamodel <previous schema> --to-schema-datamodel prisma/schema.prisma --script
-- (then made idempotent by hand).
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)
-- Requires approval for the shared Neon DB.

-- CreateTable
CREATE TABLE IF NOT EXISTS "DepartmentImage" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT,
    "imageUrl" TEXT,
    "imageData" BYTEA,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "altText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentImage_departmentId_key" ON "DepartmentImage"("departmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DepartmentImage_isActive_idx" ON "DepartmentImage"("isActive");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentImage_departmentId_fkey') THEN
    ALTER TABLE "DepartmentImage" ADD CONSTRAINT "DepartmentImage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentImage_uploadedById_fkey') THEN
    ALTER TABLE "DepartmentImage" ADD CONSTRAINT "DepartmentImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
