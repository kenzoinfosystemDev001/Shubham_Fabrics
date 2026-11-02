-- Department station accounts: sign-in username, full name and department.
--   program      Programming Incharge     PROGRAMMING      store        Fabric Store Incharge   STORE
--   dyeing       Dyeing Incharge          DYEING           dyeingqc     Dyeing QC Incharge      QC1
--   embroidery   Embroidery Incharge      EMBROIDERY       threadcut    Threadcut Incharge      THREAD_CUTTING
--   threadcutqc  Threadcut QC Incharge    QC2              washing      Washing Incharge        WASHING
--   washingqc    Washing QC Incharge      QC3              recutting    Recutting Incharge      RECUTTING
--   stitching    Stitching Incharge       STITCHING        finishing    Finishing Incharge      FINISHING
--   steampress   Steam Press Incharge     STEAM_PRESS      finalqc      Final QC Incharge       FINAL_CHECK
--   inventory    Inventory Incharge       INVENTORY
-- The earlier sign-in names (qc1, qc2, qc3, qcwashing, cutting, finalcheck) still reach the same accounts
-- (stationAliases in apps/web/src/lib/departments.ts). Only usernames, names and departments change: user IDs,
-- PINs and every record that names these users stay as they are.
-- Re-runnable. Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

-- 1. The Programming station account had the username "qcwashing" (an older Washing QC sign-in name).
UPDATE "User" SET "username" = 'program', "updatedAt" = NOW()
WHERE lower("username") = 'qcwashing' AND "departmentCode" = 'PROGRAMMING'
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE lower("username") = 'program');

-- 2. New sign-in names, where the new name is still free.
UPDATE "User" u SET "username" = n.new_name, "updatedAt" = NOW()
FROM (VALUES
  ('qc1', 'dyeingqc'),
  ('qc2', 'threadcutqc'),
  ('qc3', 'washingqc'),
  ('cutting', 'threadcut'),
  ('finalcheck', 'finalqc')
) AS n(old_name, new_name)
WHERE lower(u."username") = n.old_name
  AND NOT EXISTS (SELECT 1 FROM "User" x WHERE lower(x."username") = n.new_name);

-- 3. Full name and department of each station account.
UPDATE "User" u SET "fullName" = n.full_name, "departmentCode" = n.department, "updatedAt" = NOW()
FROM (VALUES
  ('program', 'Programming Incharge', 'PROGRAMMING'),
  ('store', 'Fabric Store Incharge', 'STORE'),
  ('dyeing', 'Dyeing Incharge', 'DYEING'),
  ('dyeingqc', 'Dyeing QC Incharge', 'QC1'),
  ('embroidery', 'Embroidery Incharge', 'EMBROIDERY'),
  ('threadcut', 'Threadcut Incharge', 'THREAD_CUTTING'),
  ('threadcutqc', 'Threadcut QC Incharge', 'QC2'),
  ('washing', 'Washing Incharge', 'WASHING'),
  ('washingqc', 'Washing QC Incharge', 'QC3'),
  ('recutting', 'Recutting Incharge', 'RECUTTING'),
  ('stitching', 'Stitching Incharge', 'STITCHING'),
  ('finishing', 'Finishing Incharge', 'FINISHING'),
  ('steampress', 'Steam Press Incharge', 'STEAM_PRESS'),
  ('finalqc', 'Final QC Incharge', 'FINAL_CHECK'),
  ('inventory', 'Inventory Incharge', 'INVENTORY')
) AS n(username, full_name, department)
WHERE lower(u."username") = n.username
  AND (u."fullName" IS DISTINCT FROM n.full_name OR u."departmentCode" IS DISTINCT FROM n.department);
