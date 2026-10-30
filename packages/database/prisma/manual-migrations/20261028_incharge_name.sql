-- The department incharge's name as typed on the issuing form (e.g. "Hardik Pandya"), saved with the
-- challan and with a manual Fabric Store outward entry. Additive only: existing rows keep NULL.
-- Re-runnable (IF NOT EXISTS).

ALTER TABLE "Challan" ADD COLUMN IF NOT EXISTS "inchargeName" TEXT;
ALTER TABLE "FabricOutward" ADD COLUMN IF NOT EXISTS "inchargeName" TEXT;
