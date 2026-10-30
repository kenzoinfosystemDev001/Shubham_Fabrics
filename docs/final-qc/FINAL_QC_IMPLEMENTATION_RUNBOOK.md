# Final QC Implementation Runbook

## Local validation

From the repository root:

```powershell
node --test scripts/test-final-check-rules.mjs
npx tsc --noEmit -p apps/web/tsconfig.json
npm run build --workspace=@shubham/web
```

The production build runs workspace prebuild scripts and may refresh generated Prisma client files. Inspect `git status` and the diff after building; retain only intentional generated changes.

## API areas

- Queue and dashboard: `apps/web/src/app/api/final-check/`
- Workflow actions: `challans/[id]/receive`, `jobs/[id]/start`, `jobs/[id]/hold`, `jobs/[id]/resume`, `jobs/[id]/inspect`
- Handover: `issue-challan`
- Shared access checks: `apps/web/src/lib/final-check-auth.ts`
- Shared quantity and decision rules: `apps/web/src/lib/final-check-rules.mjs`

## Integration safety

Do not run `scripts/test-final-qc-workflow.js` or any mutating API against production or a shared developer database. Create and verify a dedicated test database, seed isolated fixtures, run the suite, and clean up only those explicitly scoped test records.

## Deployment checklist

1. Confirm the environment's `STANDARD_FACTORY_ROUTE` places Final QC before the intended next department.
2. Confirm Final QC roles/users are provisioned and production credentials are not development quick-login credentials.
3. Run unit, type, and production build checks.
4. Run integration tests against an isolated database.
5. Review generated files and unrelated local work before staging or pushing.
6. Ensure shared authentication uses signed sessions before treating department authorization as a production security boundary.
