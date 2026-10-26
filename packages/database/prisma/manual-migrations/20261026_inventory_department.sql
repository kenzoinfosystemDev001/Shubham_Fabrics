-- Inventory Department replaces the "Packing & Inventory" department: Packing becomes a module of
-- Inventory. Moves everything recorded under the department codes PACKING / PACK / FOLDING (and
-- users of the old FINISHED_GOODS station) to the department code INVENTORY:
--   * the Department row (a new INVENTORY row; work centres, operations, defect codes and the sidebar
--     image move to it; the old row is removed when nothing references it any more),
--   * challans sent to or from Packing (their quantities, numbers and history are not changed),
--   * users, roles (PACKING_* -> INVENTORY_*) and the "packing" station login (-> "inventory"; the
--     PIN is unchanged and "packing" still signs in),
--   * department codes recorded on production, quality, stock, ledger, defect, rework and alert rows.
-- Historical text (remarks, audit log entries) is left as it was. The old Packing module's
-- finished-goods stock (department code FINISHED_GOODS) is left as it was.
-- One statement: either all of it applies or none of it. Re-runnable: a second run changes nothing.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

DO $$
DECLARE
  inv_id TEXT;
  old RECORD;
  pair RECORD;
BEGIN
  -- 1. The Inventory department row.
  SELECT "id" INTO inv_id FROM "Department" WHERE "code" = 'INVENTORY';
  IF inv_id IS NULL THEN
    inv_id := gen_random_uuid()::TEXT;
    INSERT INTO "Department" ("id", "code", "name", "sequenceOrder", "description", "isActive", "createdAt", "updatedAt")
    VALUES (
      inv_id, 'INVENTORY', 'Inventory Department',
      COALESCE((SELECT "sequenceOrder" FROM "Department" WHERE "code" = 'PACKING'), 16),
      'Finished garment receipt, inventory and packing',
      TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  END IF;

  -- 2. Everything that points at an old Packing department row.
  FOR old IN SELECT "id", "code" FROM "Department" WHERE "code" IN ('PACKING', 'PACK', 'FOLDING') LOOP
    UPDATE "Challan" SET "toDepartment" = 'INVENTORY' WHERE "toDepartment" = old."code";
    UPDATE "Challan" SET "fromDepartment" = 'INVENTORY' WHERE "fromDepartment" = old."code";
    UPDATE "WorkCenter" SET "departmentId" = inv_id WHERE "departmentId" = old."id";
    UPDATE "Operation" SET "departmentId" = inv_id WHERE "departmentId" = old."id";
    UPDATE "DefectCode" SET "departmentId" = inv_id WHERE "departmentId" = old."id";
    IF to_regclass('"DepartmentImage"') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "DepartmentImage" WHERE "departmentId" = inv_id) THEN
      UPDATE "DepartmentImage" SET "departmentId" = inv_id WHERE "departmentId" = old."id";
    END IF;
    BEGIN
      DELETE FROM "Department" WHERE "id" = old."id";
    EXCEPTION WHEN foreign_key_violation THEN
      -- Still referenced somewhere else: keep the row, but out of use.
      UPDATE "Department" SET "isActive" = FALSE, "name" = 'Packing (merged into Inventory)', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = old."id";
    END;
  END LOOP;

  -- 3. Department codes stored as text.
  UPDATE "User" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" IN ('PACKING', 'PACK', 'FOLDING', 'FINISHED_GOODS');
  UPDATE "Challan" SET "detectedFromDepartment" = 'INVENTORY' WHERE "detectedFromDepartment" = 'PACKING';
  UPDATE "ProgramRouteStep" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" = 'PACKING';
  UPDATE "ProductionTransaction" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" = 'PACKING';
  UPDATE "QualityInspection" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" = 'PACKING';
  UPDATE "InventoryStock" s SET "departmentCode" = 'INVENTORY'
    WHERE s."departmentCode" = 'PACKING'
      AND NOT EXISTS (SELECT 1 FROM "InventoryStock" t WHERE t."departmentCode" = 'INVENTORY' AND t."identifier" = s."identifier");
  UPDATE "StockLedgerEntry" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" = 'PACKING';
  UPDATE "Bundle" SET "currentDepartment" = 'INVENTORY' WHERE "currentDepartment" = 'PACKING';
  UPDATE "DefectRecord" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" = 'PACKING';
  UPDATE "ReworkTransaction" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" = 'PACKING';
  -- Tables added by earlier manual migrations: only when present.
  IF to_regclass('"DeadlineAlert"') IS NOT NULL THEN
    UPDATE "DeadlineAlert" SET "departmentCode" = 'INVENTORY' WHERE "departmentCode" = 'PACKING';
    UPDATE "DeadlineAlert" SET "recipientDepartments" = array_replace("recipientDepartments", 'PACKING', 'INVENTORY')
      WHERE 'PACKING' = ANY ("recipientDepartments");
  END IF;
  IF to_regclass('"DepartmentWorkItem"') IS NOT NULL THEN
    UPDATE "DepartmentWorkItem" SET "sourceDepartment" = 'INVENTORY' WHERE "sourceDepartment" = 'PACKING';
  END IF;

  -- 4. Roles: PACKING_* become INVENTORY_* (same users keep them).
  FOR pair IN SELECT * FROM (VALUES
      ('PACKING_SUPERVISOR', 'INVENTORY_SUPERVISOR', 'Inventory Supervisor'),
      ('PACKING_OPERATOR', 'INVENTORY_OPERATOR', 'Inventory Operator'),
      ('PACKING_INCHARGE', 'INVENTORY_INCHARGE', 'Inventory Incharge')
    ) AS r(old_code, new_code, new_name) LOOP
    IF NOT EXISTS (SELECT 1 FROM "Role" WHERE "code" = pair.new_code) THEN
      UPDATE "Role" SET "code" = pair.new_code, "name" = pair.new_name,
        "description" = 'Finished garment inventory and packing', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "code" = pair.old_code;
    ELSIF EXISTS (SELECT 1 FROM "Role" WHERE "code" = pair.old_code) THEN
      -- Both exist: give the old role's users the new one too.
      INSERT INTO "UserRole" ("id", "userId", "roleId", "assignedAt")
      SELECT gen_random_uuid()::TEXT, ur."userId", n."id", CURRENT_TIMESTAMP
      FROM "UserRole" ur
      JOIN "Role" o ON o."id" = ur."roleId" AND o."code" = pair.old_code
      CROSS JOIN (SELECT "id" FROM "Role" WHERE "code" = pair.new_code) n
      WHERE NOT EXISTS (SELECT 1 FROM "UserRole" x WHERE x."userId" = ur."userId" AND x."roleId" = n."id");
    END IF;
  END LOOP;

  -- 5. The station login.
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE lower("username") = 'inventory') THEN
    UPDATE "User" SET "username" = 'inventory', "updatedAt" = CURRENT_TIMESTAMP WHERE lower("username") = 'packing';
  END IF;
  UPDATE "User" SET "fullName" = 'Inventory Supervisor', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "fullName" = 'Packing Supervisor' AND "departmentCode" = 'INVENTORY';
END $$;
