-- Users removed in the admin console before 2026-11-02 were kept in the database, switched off and renamed
-- "<name>-old", whenever earlier records named them. This deletes those users and their role links for good,
-- the same way the admin console now deletes a user (apps/web/src/lib/auth/delete-user.ts): every record that
-- names them (challans, production sheets, inspections, ledgers, ...) is kept and moved to one shared,
-- switched-off "Deleted User" account, which has no usable password and can never sign in.
-- No production record is deleted. The "admin" account is never touched. Re-runnable: once no switched-off
-- "-old" account is left it changes nothing.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

DO $$
DECLARE
  retired TEXT[];
  placeholder TEXT;
  ref RECORD;
BEGIN
  SELECT array_agg("id") INTO retired
  FROM "User"
  WHERE "isActive" = false
    AND "username" ~* '-old(-[a-z0-9]+)?$'
    AND lower("username") NOT IN ('admin', 'deleted-user');

  IF retired IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "User" ("id", "username", "email", "fullName", "passwordHash", "isActive", "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, 'deleted-user', 'deleted-user@subhamfabrics.invalid', 'Deleted User', '!no-sign-in', false, NOW(), NOW())
  ON CONFLICT ("username") DO NOTHING;
  SELECT "id" INTO placeholder FROM "User" WHERE "username" = 'deleted-user';

  -- The users' own settings (role links, dismissed deadline alerts; unique per user) go with them.
  DELETE FROM "UserRole" WHERE "userId" = ANY (retired);
  IF to_regclass('"DeadlineAlertDismissal"') IS NOT NULL THEN
    DELETE FROM "DeadlineAlertDismissal" WHERE "userId" = ANY (retired);
  END IF;

  -- Every other column that points at a user, read from the foreign keys themselves.
  FOR ref IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass
      AND c.conrelid::regclass::text NOT IN ('"UserRole"', '"DeadlineAlertDismissal"')
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = ANY ($2)', ref.tbl, ref.col, ref.col) USING placeholder, retired;
  END LOOP;

  DELETE FROM "User" WHERE "id" = ANY (retired);
  RAISE NOTICE 'Deleted % retired user(s); their records now name "Deleted User".', array_length(retired, 1);
END $$;
