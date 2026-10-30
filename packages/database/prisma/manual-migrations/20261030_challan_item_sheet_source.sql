-- Sheet-wise challan lines. Additive only: no existing value changes.
-- - ChallanItem.programId: the Production Sheet each line belongs to, so one challan can carry lines of
--   several sheets and every line keeps its sheet through every department.
-- - ChallanItem.sourceChallanItemId: the incoming challan line a line was issued from (line genealogy).
-- Backfill, only where the existing records already say it exactly:
-- - programId <- the line's challan programId (every challan so far had exactly one sheet).
-- - sourceChallanItemId <- the Dyeing order (Dyeing -> Dyeing QC lines) or work item (work-item
--   departments, including Recutting -> Stitching) the line was transferred from.
-- Dyeing QC (QC1) lines issued before this change were merged per unit and have no single source
-- line; they are left NULL rather than guessed.
-- Apply with: node scripts/apply-appearance-migrations.js (production builds apply it automatically).
-- Re-runnable: IF NOT EXISTS, and the backfills only fill NULLs.

-- AlterTable
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "programId" TEXT,
ADD COLUMN IF NOT EXISTS "sourceChallanItemId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChallanItem_programId_idx" ON "ChallanItem"("programId");
CREATE INDEX IF NOT EXISTS "ChallanItem_sourceChallanItemId_idx" ON "ChallanItem"("sourceChallanItemId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallanItem_programId_fkey') THEN
    ALTER TABLE "ChallanItem" ADD CONSTRAINT "ChallanItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallanItem_sourceChallanItemId_fkey') THEN
    ALTER TABLE "ChallanItem" ADD CONSTRAINT "ChallanItem_sourceChallanItemId_fkey" FOREIGN KEY ("sourceChallanItemId") REFERENCES "ChallanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: each existing line belongs to its challan's sheet.
UPDATE "ChallanItem" ci
SET "programId" = c."programId"
FROM "Challan" c
WHERE ci."challanId" = c."id" AND ci."programId" IS NULL;

-- Backfill: Dyeing -> Dyeing QC lines came from the Store -> Dyeing line of their Dyeing order.
UPDATE "ChallanItem" ci
SET "sourceChallanItemId" = o."inboundChallanItemId"
FROM "DyeingQcTransfer" t
JOIN "DyeingOrder" o ON o."id" = t."dyeingOrderId"
WHERE t."challanItemId" = ci."id"
  AND ci."sourceChallanItemId" IS NULL
  AND o."inboundChallanItemId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "ChallanItem" s WHERE s."id" = o."inboundChallanItemId");

-- Backfill: work-item department lines came from the incoming line of their work item.
UPDATE "ChallanItem" ci
SET "sourceChallanItemId" = w."inboundChallanItemId"
FROM "DepartmentWorkTransfer" t
JOIN "DepartmentWorkItem" w ON w."id" = t."workItemId"
WHERE t."challanItemId" = ci."id"
  AND ci."sourceChallanItemId" IS NULL
  AND EXISTS (SELECT 1 FROM "ChallanItem" s WHERE s."id" = w."inboundChallanItemId");
