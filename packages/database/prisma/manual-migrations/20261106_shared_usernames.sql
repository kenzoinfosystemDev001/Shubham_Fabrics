-- Several incharges may share one department login username (e.g. three "inventory" accounts); sign-in
-- tells them apart by PIN. Drops only the uniqueness of "User"."username" and keeps a plain index for
-- lookups. No row, PIN hash, ID or email is changed. Safe to run more than once.

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_username_key";
DROP INDEX IF EXISTS "User_username_key";
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
