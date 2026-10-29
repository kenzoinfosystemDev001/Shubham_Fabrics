-- Challan numbers are unique per issuing department instead of across the whole factory:
-- Dyeing cannot issue challan "100" twice, but Embroidery may issue its own "100".
-- Existing challans already have unique numbers, so the new index always builds. The per-department
-- index is created before the factory-wide one is dropped, so uniqueness is never off.
-- Re-runnable (IF NOT EXISTS / IF EXISTS).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS "Challan_fromDepartment_challanNumber_key"
  ON "Challan" ("fromDepartment", "challanNumber");

CREATE INDEX IF NOT EXISTS "Challan_challanNumber_idx" ON "Challan" ("challanNumber");

-- The old factory-wide rule (created by `prisma db push` as a unique index; a constraint on older copies).
ALTER TABLE "Challan" DROP CONSTRAINT IF EXISTS "Challan_challanNumber_key";
DROP INDEX IF EXISTS "Challan_challanNumber_key";

COMMIT;
