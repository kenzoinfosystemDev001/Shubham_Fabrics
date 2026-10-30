# Test report

These commands were run locally on 2026-10-30 on branch `feature/production-fixes`. No test touched the database: the only database configured is the shared production database, so no data was written for testing.

## Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit -p apps/web` | Pass (0 errors) |
| `NEXT_DIST_DIR=.next-verify npx next build` (apps/web) | Pass (exit 0) |
| `node --test scripts/test-production-fixes.mjs` | Pass: 55 of 55 (45 existing, 10 new) |
| `node --test scripts/test-final-check-rules.mjs` | 7 tests pass. The file fails as a whole with `ERR_REQUIRE_ESM`, identical before this change. One assertion was updated: it asserted the old "one sheet per challan" rule this change replaces, and now asserts the new rule plus the incoming-challan checks. |
| `node --test scripts/test-inventory-department.mjs` | 4 pass, 1 file-level `ERR_REQUIRE_ESM`. Identical before this change. |
| `node --test scripts/test-deadline-alerts.mjs` | File-level `ERR_REQUIRE_ESM`. Identical before this change. |
| `node scripts/test-finishing-workflow.js`, `node scripts/test-steam-press-workflow.js` | Not runnable: they need `DATABASE_URL`, and the only database is production. |

"Identical before this change" was checked by stashing the change and running the same command.

## Spec scenarios

| # | Scenario | Covered by | Status |
|---|---|---|---|
| 1 | Explicit challan selection: the second of three challans is chosen | `incoming challans: options group …`: lines are offered only for the selected challan. The picker never preselects. | Rule tested; UI not run in a browser |
| 2 | Three sheets on one challan (100, 150, 200 m) | `sheets: one challan carries three sheets …`, `… same fabric and colour stay apart` | Tested |
| 3 | Processing after Dyeing keeps the sheets | `issue: Dyeing lines of several sheets …`, `QC1: each dyed line is inspected on its own …` | Rules tested; the QC1 route and issue services were type-checked and built, not run against a database |
| 4 | The next department sees the breakdown | Work items take the line's sheet (`syncWorkItems`). The detail page and prints show sheets per line. | Implemented; not run end to end |
| 5 | Partial processing | `issue: partial transfer of one sheet leaves the rest available …` | Tested |
| 6 | Line not on the selected challan | `incoming challans: a line from an unselected challan is refused …`, the validator tests, `QC1 … not on this challan` | Tested (rules). The server calls the same validators before writing anything. |
| 7 | Over-issuing | `issue: partial transfer … over-issuing is refused`, `… only 100 MTR of D1`, the QC1 line limits | Tested |
| 8 | Concurrent issues | Existing optimistic guards (`updateMany` on the counters read; 409 on conflict), unchanged | Not tested: needs a test database |
| 9 | Duplicate submission | Existing idempotency keys per issue endpoint, unchanged | Not tested: needs a test database |
| 10 | Units | `sheets: meters and pieces are totalled separately …` (450 MTR · 320 PCS, never 770), QC1 per-unit mapping | Tested. Kilograms are not a unit in this system (MTR and PCS only). |
| 11 | Legacy challans | `sheets: a line recorded before per-line sheets …`, QC1 per-unit input accepted only when it maps to exactly one line | Tested |
| 12 | Department coverage | [DEPARTMENT_COVERAGE.md](DEPARTMENT_COVERAGE.md) | Code audited for every department; not run end to end |

## Known limitations

- **Database migration not applied:** `20261030_challan_item_sheet_source.sql` has not been applied to any database. It applies on the next production build, as with the earlier migrations, or by running `node scripts/apply-appearance-migrations.js`.
- **Not exercised end to end:** no browser session or database transaction was run for the new flows. Scenarios 3, 4 and 12 still need one real walk-through: Store (two sheets) → Dyeing → Dyeing QC → Embroidery.
