# Final QC Test Report

## Focused automated checks

Command: `node --test scripts/test-final-check-rules.mjs`

| Check | Result |
|---|---|
| Valid reconciled inspection quantities | Pass |
| Negative, decimal, malformed, and unsafe piece counts rejected | Pass |
| Unreconciled inspection outputs rejected | Pass |
| Pending quantity retained as a distinct balance | Pass |
| Failed/missing checkpoints cannot produce a passing inspection decision | Pass |
| Handover capped by accepted quantity less prior transfers | Pass |

Web TypeScript validation: `npx tsc --noEmit -p apps/web/tsconfig.json` — passed.

Production build: `npm run build --workspace=@subham/web` — passed, including workspace prebuild and Next.js production compilation/type validation.

## Not performed

- No database-backed or browser end-to-end test was run. These routes mutate live workflow records, so any integration run requires an explicitly isolated test database and safe fixtures.
- Polling freshness, visual layout, and real employee login were not tested in a browser in this session.

## Regression checklist

- Confirm a non-Final-QC active user receives `403` on Final QC APIs.
- Confirm concurrent receive/start/hold/resume/inspection and handover requests produce one valid state transition and return a conflict for stale requests.
- Confirm inspection totals reconcile, rejected pieces are quarantined, rework remains untransferred, and only accepted balance can reach the configured next department.
- Run these scenarios only against an isolated database.
