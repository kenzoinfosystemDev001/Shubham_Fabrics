-- Department station accounts keep their usernames and are named "<Department> Incharge"; the QC
-- accounts also get the right department and role:
--   qc1 -> Dyeing QC Incharge     (department QC1, role QC1_INSPECTOR)
--   qc2 -> Threadcut QC Incharge  (department QC2, role QC2_INSPECTOR)
--   qc3 -> Washing QC Incharge    (department QC3, role QC3_INSPECTOR)
--   qcwashing (a second Washing QC account) -> retired in step 5; its sign-in name reaches qc3
-- An earlier version of this file renamed these accounts (dyeingqc / threadcutqc / washingqc) and merged
-- qc3; step 1 puts the original usernames back wherever that version already ran.
-- Only username, full name, department and an added role change: user IDs, PINs, other roles and every
-- record that names these users stay as they are. Re-runnable.

-- 1. Undo the earlier rename (only where it happened and the original name is free).
UPDATE "User" SET "username" = 'qc1', "updatedAt" = NOW()
WHERE lower("username") = 'dyeingqc' AND NOT EXISTS (SELECT 1 FROM "User" WHERE lower("username") = 'qc1');
UPDATE "User" SET "username" = 'qc2', "updatedAt" = NOW()
WHERE lower("username") = 'threadcutqc' AND NOT EXISTS (SELECT 1 FROM "User" WHERE lower("username") = 'qc2');
UPDATE "User" SET "username" = 'qcwashing', "updatedAt" = NOW()
WHERE lower("username") = 'washingqc' AND NOT EXISTS (SELECT 1 FROM "User" WHERE lower("username") = 'qcwashing');
UPDATE "User" SET "username" = 'qc3', "isActive" = true, "updatedAt" = NOW()
WHERE lower("username") = 'washingqc-archived' AND NOT EXISTS (SELECT 1 FROM "User" WHERE lower("username") = 'qc3');

-- 2. Each department's station account is named "<Department> Incharge"; the QC accounts also get their
--    department set. Accounts with any other username (people with their own sign-in) keep their names.
UPDATE "User" SET "fullName" = 'Dyeing QC Incharge', "departmentCode" = 'QC1', "updatedAt" = NOW()
WHERE lower("username") = 'qc1';
UPDATE "User" SET "fullName" = 'Threadcut QC Incharge', "departmentCode" = 'QC2', "updatedAt" = NOW()
WHERE lower("username") = 'qc2';
UPDATE "User" SET "fullName" = 'Washing QC Incharge', "departmentCode" = 'QC3', "updatedAt" = NOW()
WHERE lower("username") IN ('qc3', 'qcwashing');
UPDATE "User" u SET "fullName" = n.full_name, "updatedAt" = NOW()
FROM (VALUES
  ('program', 'Programming Incharge'),
  ('store', 'Fabric Store Incharge'),
  ('dyeing', 'Dyeing Incharge'),
  ('embroidery', 'Embroidery Incharge'),
  ('cutting', 'Thread Cutting Incharge'),
  ('washing', 'Washing Incharge'),
  ('recutting', 'Recutting Incharge'),
  ('stitching', 'Stitching Incharge'),
  ('finishing', 'Finishing Incharge'),
  ('steampress', 'Steam Press Incharge'),
  ('finalcheck', 'Final QC Incharge'),
  ('inventory', 'Inventory Incharge')
) AS n(username, full_name)
WHERE lower(u."username") = n.username AND u."fullName" IS DISTINCT FROM n.full_name;

-- 3. Each account holds its own department's inspector role (added when the role exists; none removed).
INSERT INTO "UserRole" ("id", "userId", "roleId", "assignedAt")
SELECT gen_random_uuid()::text, u."id", r."id", NOW()
FROM "User" u
JOIN "Role" r ON r."code" = CASE lower(u."username")
  WHEN 'qc1' THEN 'QC1_INSPECTOR'
  WHEN 'qc2' THEN 'QC2_INSPECTOR'
  WHEN 'qc3' THEN 'QC3_INSPECTOR'
  WHEN 'qcwashing' THEN 'QC3_INSPECTOR'
END
WHERE lower(u."username") IN ('qc1', 'qc2', 'qc3', 'qcwashing')
  AND NOT EXISTS (SELECT 1 FROM "UserRole" ur WHERE ur."userId" = u."id" AND ur."roleId" = r."id");

-- 4. Display name of the Washing QC role.
UPDATE "Role" SET "name" = 'Washing QC Inspector' WHERE "code" = 'QC3_INSPECTOR' AND "name" = 'QC Washing Inspector';

-- 5. One account per department station. Where an older sign-in name of a station (its alias in
--    lib/departments.ts) is a separate account next to the station's own account, that duplicate is
--    removed when nothing refers to it; when its history (challans, inspections, audit) names it, it
--    is kept for that history but switched off and renamed "<name>-old" (hidden from Users & RBAC).
--    Typing the old name at sign-in then reaches the station's own account. Accounts with any other
--    username are never touched. Only runs while the station's own account exists.
DO $$
DECLARE
  pair RECORD;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('qc3', 'qcwashing'),
      ('qc3', 'qc_washing'),
      ('program', 'programmer'),
      ('recutting', 'recutting_incharge'),
      ('recutting', 'recutting_supervisor'),
      ('inventory', 'packing')
    ) AS t(keep_name, duplicate_name)
  LOOP
    IF EXISTS (SELECT 1 FROM "User" WHERE lower("username") = pair.duplicate_name)
       AND EXISTS (SELECT 1 FROM "User" WHERE lower("username") = pair.keep_name) THEN
      BEGIN
        DELETE FROM "UserRole" WHERE "userId" IN (SELECT "id" FROM "User" WHERE lower("username") = pair.duplicate_name);
        DELETE FROM "User" WHERE lower("username") = pair.duplicate_name;
      EXCEPTION WHEN foreign_key_violation THEN
        UPDATE "User"
        SET "username" = pair.duplicate_name || '-old', "isActive" = false, "updatedAt" = NOW()
        WHERE lower("username") = pair.duplicate_name
          AND NOT EXISTS (SELECT 1 FROM "User" WHERE lower("username") = pair.duplicate_name || '-old');
      END;
    END IF;
  END LOOP;
END $$;
