-- Indexes for the columns every department screen filters on (incoming / outgoing challans by department and
-- status, a sheet's challans, a challan's lines and production records). Indexes only: no row is changed.
-- Apply with: node scripts/apply-appearance-migrations.js (production builds apply it automatically).
-- Re-runnable (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS "Challan_toDepartment_status_idx" ON "Challan"("toDepartment", "status");
CREATE INDEX IF NOT EXISTS "Challan_fromDepartment_status_idx" ON "Challan"("fromDepartment", "status");
CREATE INDEX IF NOT EXISTS "Challan_programId_idx" ON "Challan"("programId");
CREATE INDEX IF NOT EXISTS "Challan_parentChallanId_idx" ON "Challan"("parentChallanId");
CREATE INDEX IF NOT EXISTS "ChallanItem_challanId_idx" ON "ChallanItem"("challanId");
CREATE INDEX IF NOT EXISTS "ProductionTransaction_challanId_idx" ON "ProductionTransaction"("challanId");
CREATE INDEX IF NOT EXISTS "ProductionTransaction_programId_departmentCode_idx" ON "ProductionTransaction"("programId", "departmentCode");
