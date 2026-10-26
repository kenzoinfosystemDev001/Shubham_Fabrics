-- Branding assets (login page background): additive only (one new table, one index, one foreign key).
-- Re-runnable: every statement is skipped when its object already exists. No existing row is changed.
-- Generated with: prisma migrate diff --from-schema-datamodel <previous schema> --to-schema-datamodel prisma/schema.prisma --script
-- (then made idempotent by hand).
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)
-- Requires approval for the shared Neon DB.

-- CreateTable
CREATE TABLE IF NOT EXISTS "BrandingAsset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
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

    CONSTRAINT "BrandingAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BrandingAsset_key_key" ON "BrandingAsset"("key");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BrandingAsset_uploadedById_fkey') THEN
    ALTER TABLE "BrandingAsset" ADD CONSTRAINT "BrandingAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
