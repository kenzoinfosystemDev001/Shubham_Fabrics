-- Fabric width per challan line. Additive only: existing lines keep NULL (no width recorded).
-- Each line stores its own width as entered (e.g. "44 Inch"); a challan never has one common width.
-- Apply with: node scripts/apply-appearance-migrations.js (production builds apply it automatically).
-- Re-runnable (IF NOT EXISTS).

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "width" TEXT;
