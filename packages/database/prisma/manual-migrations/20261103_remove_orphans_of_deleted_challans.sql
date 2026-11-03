-- Removes records left behind by "Delete All Challans" before it was fixed. That route unlinked dyeing orders
-- (inboundChallanId set to NULL) instead of deleting them, so they stayed open and kept appearing in Dyeing's
-- Pending Work, and it left HOLD records whose line no longer exists.
-- Every dyeing order is created from an incoming challan line (lib/dyeing-sync.ts), so one without an incoming
-- challan exists only because its challan was deleted. Their Dyeing QC transfers cascade. Audit logs are kept.
-- Re-runnable: once the orphans are gone it changes nothing.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- HOLDs whose line was deleted (or is one of the orphaned dyeing orders). Their history and releases cascade.
DELETE FROM "DepartmentHold" h
WHERE (h."sourceType" = 'DYEING_ORDER'
       AND NOT EXISTS (SELECT 1 FROM "DyeingOrder" o WHERE o."id" = h."sourceId" AND o."inboundChallanId" IS NOT NULL))
   OR (h."sourceType" = 'WORK_ITEM'
       AND NOT EXISTS (SELECT 1 FROM "DepartmentWorkItem" w WHERE w."id" = h."sourceId"))
   OR (h."sourceType" = 'QC1_CHALLAN'
       AND NOT EXISTS (SELECT 1 FROM "Challan" c WHERE c."id" = h."sourceId"));

-- Dyeing orders of deleted challans.
DELETE FROM "DyeingOrder" WHERE "inboundChallanId" IS NULL;
