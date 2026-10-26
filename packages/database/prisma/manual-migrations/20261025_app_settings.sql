-- App settings (e.g. the department background on/off switch): additive only (one new table). No existing row is changed.
-- Re-runnable: skipped when the table already exists.
-- Generated with: prisma migrate diff --from-schema-datamodel <previous schema> --to-schema-datamodel prisma/schema.prisma --script
-- (then made idempotent by hand).
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)
-- Requires approval for the shared Neon DB.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
