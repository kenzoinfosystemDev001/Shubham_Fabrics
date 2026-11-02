-- HOLD records keep the line's production details as they were when the HOLD was placed: production type
-- (TOP / BOTTOM / DUPATTA), required colour, the incoming challan's date, the sending department and the quantity
-- already processed. Additive: nullable columns, then filled for existing HOLDs from their lines. Re-runnable.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

ALTER TABLE "DepartmentHold" ADD COLUMN IF NOT EXISTS "productionType" TEXT;
ALTER TABLE "DepartmentHold" ADD COLUMN IF NOT EXISTS "requiredColour" TEXT;
ALTER TABLE "DepartmentHold" ADD COLUMN IF NOT EXISTS "challanDate" TIMESTAMP(3);
ALTER TABLE "DepartmentHold" ADD COLUMN IF NOT EXISTS "sendingDepartment" TEXT;
ALTER TABLE "DepartmentHold" ADD COLUMN IF NOT EXISTS "processedAtHold" DOUBLE PRECISION;

-- Work items (Embroidery to Inventory)
UPDATE "DepartmentHold" h
SET "productionType" = COALESCE(h."productionType", w."garmentCategory"),
    "sendingDepartment" = COALESCE(h."sendingDepartment", w."sourceDepartment"),
    "challanDate" = COALESCE(h."challanDate", c."issuedDate", c."createdAt")
FROM "DepartmentWorkItem" w
JOIN "Challan" c ON c."id" = w."inboundChallanId"
WHERE h."sourceType" = 'WORK_ITEM' AND h."sourceId" = w."id";

-- Dyeing orders
UPDATE "DepartmentHold" h
SET "requiredColour" = COALESCE(h."requiredColour", NULLIF(o."targetColor", '')),
    "sendingDepartment" = COALESCE(h."sendingDepartment", c."fromDepartment"),
    "challanDate" = COALESCE(h."challanDate", c."issuedDate", c."createdAt")
FROM "DyeingOrder" o
LEFT JOIN "Challan" c ON c."id" = o."inboundChallanId"
WHERE h."sourceType" = 'DYEING_ORDER' AND h."sourceId" = o."id";

-- Dyeing QC challans
UPDATE "DepartmentHold" h
SET "sendingDepartment" = COALESCE(h."sendingDepartment", c."fromDepartment"),
    "challanDate" = COALESCE(h."challanDate", c."issuedDate", c."createdAt")
FROM "Challan" c
WHERE h."sourceType" = 'QC1_CHALLAN' AND h."sourceId" = c."id";
