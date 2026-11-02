-- Users no longer have roles: access comes from each user's department (Administration = full access), and
-- the admin console no longer shows or sets a role. This deletes every role, every user-role link and every
-- role-permission link. The tables stay (empty), so nothing else in the schema changes. Users, departments
-- and all production records are untouched.
-- Runs after every other migration in scripts/apply-appearance-migrations.js, so an earlier file that adds a
-- role (re-applied with --force) is always followed by this one. Re-runnable.
-- Apply with: node scripts/apply-appearance-migrations.js   (from the Shubham_Fabrics folder)

DELETE FROM "RolePermission";
DELETE FROM "UserRole";
DELETE FROM "Role";
