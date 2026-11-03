-- Fabric Store > Outward Fabric Dispatches: Average and Issue PCS Qty are filled in on that screen by the department
-- (never calculated from meters, never taken from the issuing form). Additive only; safe to run more than once.
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "outwardAverage" DOUBLE PRECISION;
ALTER TABLE "ChallanItem" ADD COLUMN IF NOT EXISTS "outwardPcs" DOUBLE PRECISION;
