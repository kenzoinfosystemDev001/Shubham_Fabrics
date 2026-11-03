-- HOLD releases: every release of quantity from a HOLD, back to the department's available quantity (AVAILABLE) or
-- released and sent on a new challan in the same transaction (FORWARD), with the original challan line and the
-- new challan. Additive and re-runnable; releases recorded before this table existed are copied in once from the
-- HOLD history (as AVAILABLE releases).
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

CREATE TABLE IF NOT EXISTS "DepartmentHoldRelease" (
  "id" TEXT NOT NULL,
  "holdId" TEXT NOT NULL,
  "departmentCode" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "remainingAfter" DOUBLE PRECISION NOT NULL,
  "programId" TEXT NOT NULL,
  "originalChallanId" TEXT,
  "originalChallanNumber" TEXT,
  "originalChallanItemId" TEXT,
  "newChallanId" TEXT,
  "newChallanNumber" TEXT,
  "newChallanItemId" TEXT,
  "destinationDepartment" TEXT,
  "eventId" TEXT,
  "idempotencyKey" TEXT,
  "remarks" TEXT,
  "releasedById" TEXT,
  "releasedByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentHoldRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentHoldRelease_idempotencyKey_key" ON "DepartmentHoldRelease"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "DepartmentHoldRelease_holdId_idx" ON "DepartmentHoldRelease"("holdId");
CREATE INDEX IF NOT EXISTS "DepartmentHoldRelease_departmentCode_createdAt_idx" ON "DepartmentHoldRelease"("departmentCode", "createdAt");
CREATE INDEX IF NOT EXISTS "DepartmentHoldRelease_newChallanId_idx" ON "DepartmentHoldRelease"("newChallanId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHoldRelease_holdId_fkey') THEN
    ALTER TABLE "DepartmentHoldRelease" ADD CONSTRAINT "DepartmentHoldRelease_holdId_fkey"
      FOREIGN KEY ("holdId") REFERENCES "DepartmentHold"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentHoldRelease_newChallanId_fkey') THEN
    ALTER TABLE "DepartmentHoldRelease" ADD CONSTRAINT "DepartmentHoldRelease_newChallanId_fkey"
      FOREIGN KEY ("newChallanId") REFERENCES "Challan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Releases made before this table existed (HOLD history RELEASE entries not yet copied).
INSERT INTO "DepartmentHoldRelease" (
  "id", "holdId", "departmentCode", "mode", "quantity", "unit", "remainingAfter", "programId",
  "originalChallanId", "originalChallanNumber", "eventId", "remarks", "releasedById", "releasedByName", "createdAt"
)
SELECT gen_random_uuid()::text, e."holdId", h."departmentCode", 'AVAILABLE', e."quantity", e."unit", e."remainingAfter", h."programId",
       h."challanId", h."challanNumber", e."id", e."remarks", e."actorId", e."actorName", e."createdAt"
FROM "DepartmentHoldEvent" e
JOIN "DepartmentHold" h ON h."id" = e."holdId"
WHERE e."action" = 'RELEASE'
  AND NOT EXISTS (SELECT 1 FROM "DepartmentHoldRelease" r WHERE r."eventId" = e."id");
