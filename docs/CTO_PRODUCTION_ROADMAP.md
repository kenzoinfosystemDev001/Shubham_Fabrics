# Shubham Fabrics MES: Production Readiness Assessment & Roadmap

**Date:** 2026-10-24  **Branch reviewed:** `feature/packing-inventory-department` (incl. commits e374ee6, f97a5a4)
**Companion document:** [PRODUCTION_READINESS_AUDIT.md](PRODUCTION_READINESS_AUDIT.md) has the bug-level findings with file and line references.

---

## 1. Executive verdict

The product covers the factory's whole flow, with all 16 departments from Programming to Packing. The screens are rich, and the domain thinking (challans, genealogy, QC loops) is sound. **It is a well-featured prototype, not yet a production system.**

The main risk is no longer the UI. It is **the trustworthiness of the numbers**. A production MES is a system of record: if metres or pieces can be double-counted, lost, or issued twice, the floor stops trusting it within weeks and goes back to paper. Today that can happen through ordinary use: double-clicks, two tablets, retries, partial dispatches.

| | |
|---|---|
| **Recommendation** | Do not go live factory-wide yet. Finish the "must-have" tracks below, then pilot on **one production line / one order** for 2–3 weeks before the full rollout. |
| **Size of the remaining work** | About **35–45 person-weeks**, or roughly **10–12 weeks for a team of 3 developers + 1 QA**, to a defensible v1. |
| **Biggest single item** | Rebuilding the challan state machine and quantity ledger. That is about 40% of the remaining effort. |

## 2. Codebase at a glance

| Metric | Value | What it tells us |
|---|---|---|
| Web pages | 102 | Broad functional coverage |
| Web API route files | 153 (~20.8k LOC) | Business logic lives in route handlers, heavily copy-pasted between departments |
| Page code | ~75k LOC; 10 "my-work" pages are 1,200–2,400 lines each | Hard to change safely; logic is duplicated in the UI |
| NestJS API (`apps/api`) | 23 modules, ~7k LOC | **Not used by the web app**: a second, diverging backend |
| Prisma models | 60 | Reasonable domain model; integrity rules missing |
| Automated tests | **0** (and `.gitignore` bans test files) | No safety net for any change |
| `any` types | 1,086 | Types don't protect against contract bugs, which already broke Packing |
| Runtime input validation (zod) | 0 web routes (the `@shubham/validation` package is used only by the dead NestJS API) | Bad input reaches the database |
| Error tracking / logging / alerting | None (261 `console.*` calls) | Production failures will be invisible |
| DB migrations | None (`prisma db push`) | Schema changes are unreviewed and can't be rolled back |
| Navigation components | 15 near-identical copies | Every UI change has to be made 15 times |
| Polling | ~18 `setInterval` loops at 1–6 s | DB/serverless load grows with every tablet |

## 3. Scorecard

Scores are out of 10, where 10 means production grade.

| Area | Before audit | Today | Target for go-live |
|---|:-:|:-:|:-:|
| Security & access control | 1 | **6** | 8 |
| Data integrity & business rules | 3 | 3 | **9** |
| Data model & database | 4 | 4 | 8 |
| Architecture & code health | 3 | 3 | 6 |
| Testing & QA | 0 | 0 | **7** |
| DevOps, environments, CI/CD | 2 | 2 | 7 |
| Observability & support | 0 | 0 | 7 |
| Performance & scalability | 4 | 4 | 7 |
| Shop-floor UX & resilience | 6 | 6 | 8 |
| Compliance & documents (GST) | ? | ? | needs business confirmation |
| Process, team & rollout | 2 | 3 | 7 |

**Already done in this branch (Phase 0):**
- Secrets removed from code.
- Master PINs and demo logins removed.
- Signed httpOnly sessions and middleware.
- Department-level authorization on every department API.
- The acting user always comes from the session.
- Admin user management: add, edit, change PIN, deactivate, delete.

---

## 4. Workstreams: what must change, how much, and in what order

Priority: **P0** = blocks go-live · **P1** = needed within ~3 months of go-live · **P2** = improvement.
Effort is in person-weeks (pw) for an experienced full-stack developer.

### 4.1 Data integrity & business rules (P0, ~14–18 pw, the core of the work)

**What's wrong.** Every department has the same structural flaws:
- Status is checked, then updated without a condition (race conditions).
- Available quantity is computed outside the transaction.
- Quantities from the client are trusted.
- The over-issue check is switched off when good = 0.
- Rework, reject and hold quantities have nowhere to go.
- Some departments forward the *received* quantity instead of the *passed* quantity.

Fabric Store keeps three stock models that disagree with each other.

**What to build:**
1. **Challan state machine service.** A single `lib/domain/challan-state.ts` with an explicit transition table per department. Every transition is a conditional `updateMany` on the expected status inside a transaction, plus a `ChallanEvent`. All ~110 department job/receive/inspect/issue routes are rewritten on top of it. They are ~90% clones today, so they collapse into one parameterised service, and 150 route files become about 40.
2. **Quantity ledger per challan:** received → good / rework / reject / hold / loss → forwarded. Enforce `forwarded + reject + rework + hold + loss ≤ received` in code **and** with DB CHECK constraints. Forwarding computes its quantity on the server from the ledger, never from the browser.
3. **Disposition flows that are missing today:**
   - rework routed back to the source department;
   - rejects to recut or scrap;
   - QC hold → release;
   - dyeing shrinkage / process loss;
   - receive shortages as discrepancy records.
4. **One fabric stock ledger.** Signed movements per fabric/location with a stored running balance, `CHECK (balance >= 0)`, and per-program reservation. The FabricInward/Outward and roll models merge into it.
5. **Finished goods:** a dispatch flow (DispatchOrder is currently unused) and a guarded stock decrement.
6. **Document numbering:**
   - Postgres sequences per document type and financial year, replacing `count()+1` and `Date.now()`.
   - Idempotency keys on every POST, so retries don't duplicate.

**How much changes:** about 60% of the API layer is rewritten, and about 30% of the department pages need contract changes. Most UI stays.

### 4.2 Data model & database (P0, ~4–5 pw)

- Move to **Prisma migrations** (`migrate deploy` in CI/CD). Baseline the current production schema first.
- Indexes:
  - `Challan(programId)`, `(toDepartment, status)`, `(fromDepartment, status)`;
  - date columns used by reports.
- Unique constraints:
  - `DyeingOrder.inboundChallanId`;
  - `(supplier, billNo)`;
  - a forward-idempotency key;
  - `programSerialNo`.
- `Decimal` for metres and money, `Int` for pieces (63 `Float` columns today). Use enums for status, unit and department.
- Soft delete for programs and challans. Audit and ledger tables become **append-only**. Remove the hard-delete cascades that erase production history.
- **Data cleanup and cutover plan.** Existing records were produced by the flawed logic and likely contain double counts. Choose one:
  - (a) a reconciliation script with a manual review, or
  - (b) a clean opening balance on go-live day (stock take + WIP count). **Recommended.**
- **Backups:**
  - Confirm that the Neon plan includes point-in-time restore.
  - Add a nightly logical backup to separate storage.
  - Run a restore drill once a quarter.

### 4.3 Security: remaining items (P0 → P1, ~3 pw)

| Item | Priority |
|---|---|
| **Rotate both Neon passwords; purge them from git history; add gitleaks to CI** | P0 (do this week) |
| Set `AUTH_SECRET` and `DATABASE_URL` in every environment | P0 (production login is broken until this is done) |
| Force every user to change PIN at first login (all 17 accounts still use their defaults) | P0 |
| Login rate-limit and lockout after N failed attempts | P0 |
| Upload endpoint: size limit, MIME allowlist, fixed folder, no base64-in-DB fallback | P0 |
| Strip `clientCode` from `metadataJson` in every program response (only Programming/Admin may see it) | P0 |
| Security headers (CSP, HSTS, frame-ancestors); clear the service-worker cache on logout for shared tablets | P1 |
| Session revocation (token version on user) so "log out everywhere" works instantly | P1 |
| Remove or relocate `clear-all-data` / `delete-all` from production builds | P1 |
| Personal accounts instead of shared department logins, so the audit trail names a person | P1 (business decision) |

### 4.4 Architecture & code health (P1, ~6–8 pw, mostly overlaps with 4.1)

- **Choose one backend.** Delete `apps/api` (NestJS), or move all logic into it; don't keep both. Recommendation: **delete it** and keep Next.js route handlers on top of a proper domain/service layer (`lib/domain/*`). Fix the docker/nginx setup, which currently routes `/api` to the dead service.
- **Layering:**
  - route handler = auth + validation + call service;
  - service = business rules + transaction;
  - repository = Prisma.

  No business logic in React pages.
- **Contracts:** zod schemas in `@shubham/validation`, shared by the routes and the pages, with typed DTOs. This removes the class of bug that broke Packing (`quantity` vs `packingQuantity`) and the QC2/Washing "Failed" message (`data.success`). Use one response envelope everywhere.
- **De-duplicate:**
  - 15 Navigation components → 1 configurable component;
  - Finishing/Steam Press and QC2/QC-Washing route clones → shared modules;
  - delete the `qc3` / `qc-washing` aliases.
- Split the 1,200–2,400-line pages into components and hooks. Reduce the `any` count.
- Stop committing the generated Prisma clients (2 × ~47 MB, including native binaries); generate at build time instead.
- Add ESLint + Prettier, `tsc --noEmit` for all workspaces, and a pre-commit hook.

### 4.5 Testing & QA (P0, ~6–8 pw, including writing the tests)

- Remove the `.gitignore` ban on `*.test.*` / `test/`.
- **Unit tests** for the quantity and transition rules (the ledger maths is where the money is).
- **Integration tests** for every department route against a disposable Postgres. Negative cases must be covered:
  - double receive and double complete;
  - issue before receive;
  - over-issue across destinations;
  - concurrent pack;
  - HOLD recorded as a pass;
  - wrong department (403).
- **One end-to-end test** (Playwright) that takes a program through all 16 departments and checks that the totals balance at every hop. This is the single most valuable test in the system.
- Replace `scripts/test-*-workflow.js`: they test copies of the logic, not the real routes.
- **UAT** with each department incharge on a staging copy before the pilot.

### 4.6 DevOps, environments, CI/CD (P0, ~3 pw)

- **Three environments:** local, **staging** (separate Neon branch/database), and production. Today production is the only shared database: the earlier code even fell back to it silently.
- **CI** on every PR: install → lint → typecheck → `prisma validate` → unit + integration tests → build. Branch protection on `main` with required review (recent commits went straight to `main`).
- **CD:** Vercel deploys `main` to production and PRs to previews against the staging DB. The migrations step runs before the traffic switch, with a documented rollback.
- Drop the Render free-plan NestJS service. Choose paid plans that don't cold-start during a shift.
- Manage environment variables per environment, with a written list of required variables (AUTH_SECRET, DATABASE_URL, CLOUDINARY_*, ALLOW_DESTRUCTIVE_ADMIN_ACTIONS).

### 4.7 Observability & support (P0 → P1, ~2 pw)

- Error tracking (Sentry or similar) on the server and in the browser, with release tagging.
- Structured JSON logs with a request ID and the user ID; ship them somewhere searchable.
- Uptime check on `/api/health` (including a DB ping), with alerts to the owner by phone or WhatsApp.
- A **business health dashboard:** stuck challans (no movement for more than X hours), negative-balance attempts, and rejected-transition counts per department.
- Run the integrity scan as a nightly job. There is an `IntegrityScanResult` model that nothing uses.
- A support runbook: who is on call during shifts, how to correct a wrong challan (an adjustment entry, never a direct DB edit).

### 4.8 Performance & scalability (P1, ~3 pw)

- Dashboards and reports currently total `take: 20–400` slices, so they are both **wrong and slow**. Rewrite them with `groupBy` / `aggregate`, backed by the indexes in 4.2.
- Paginate every list endpoint. Several load whole tables with nested includes (`/api/programs`, `/api/challans`, `/api/floorboard/state`).
- Replace 1–6 s polling with 15–30 s polling, or Server-Sent Events for floor boards. 20 tablets polling every 5 s is about 240 requests per minute of heavy queries against a serverless database.
- `dyeing-sync` writes to the DB on every GET. Move it to the challan-issue event.
- Measure first: in dev, dashboard requests took 4–15 s against the remote DB. Set a budget, e.g. p95 under 800 ms for floor screens.

### 4.9 Shop-floor UX & resilience (P1, ~3–4 pw)

- Add `error.tsx` / `loading.tsx` boundaries (there are none). A crash today means a blank screen.
- **Unreliable factory Wi-Fi:**
  - clear "offline / saving / saved" states;
  - disable buttons while a request is in flight (together with server idempotency, this ends duplicate challans);
  - no silent `.catch(() => {})`.
- Tablet-first layouts for the my-work screens. Scanner-friendly barcode input for rolls, bundles and challans.
- **Hindi** (and possibly local-language) labels for floor staff.
- Print reliability: test challan and sticker printing on the actual factory printers.
- Show units explicitly everywhere (MTR vs PCS), with conversion rules where a department changes units.

### 4.10 Compliance & documents (needs business confirmation, ~1–3 pw)

- Inside one factory premises, department-to-department challans are internal documents. **However, if any step (often dyeing, embroidery or washing) is done by an external job-worker or at another premises,** those challans are legal **delivery challans for job work** under GST. They then need:
  - consignor/consignee GSTIN;
  - HSN;
  - quantity and value;
  - serial numbering per financial year;
  - possibly an e-way bill, above the value threshold.

  The schema stores only a supplier `taxNumber` today. **Confirm with the accountant** before go-live.
- Data retention: keep challans and ledgers for the statutory period. This is another reason for soft delete and append-only audit.

### 4.11 Process, team & rollout (P0, ongoing)

- Keep the docs honest. Several `*_TEST_REPORT.md` files describe passing tests that don't exercise the real code. Keep docs that match reality, or none.
- One code owner per domain (Store/Dyeing, QC loop, Sewing line, FG/Dispatch), plus mandatory PR review.
- **Rollout plan:**
  1. Staging UAT.
  2. **Pilot on one order through all departments**, with paper in parallel; reconcile daily.
  3. Fix and harden.
  4. Department-by-department cut-over.
  5. Paper retired after 2 clean weeks.
- Training: a 30-minute session per department, plus a one-page SOP on each station.

---

## 5. Effort summary

| Workstream | Priority | Effort (pw) |
|---|:-:|:-:|
| 4.1 Data integrity & business rules | P0 | 14–18 |
| 4.2 Data model & database (+ cutover) | P0 | 4–5 |
| 4.3 Security (remaining) | P0/P1 | 3 |
| 4.4 Architecture & code health | P1 | 6–8 (≈half overlaps 4.1) |
| 4.5 Testing & QA | P0 | 6–8 |
| 4.6 DevOps / CI/CD | P0 | 3 |
| 4.7 Observability | P0/P1 | 2 |
| 4.8 Performance | P1 | 3 |
| 4.9 Shop-floor UX | P1 | 3–4 |
| 4.10 Compliance | ? | 1–3 |
| **Total (after overlap)** | | **≈ 35–45 pw** |

## 6. Suggested 12-week plan (3 developers + 1 QA)

| Weeks | Focus | Exit criterion |
|---|---|---|
| 0 (this week) | Rotate DB credentials, set AUTH_SECRET, force PIN change, merge the security branch | Production login works; no known credential exposure |
| 1–2 | Staging environment, CI pipeline, migrations baseline, error tracking, test harness | Every PR is built, typechecked and tested; staging mirrors production |
| 3–7 | Challan state-machine service + quantity ledger; port all departments; fabric stock ledger; sequences; idempotency | E2E test passes: one program through 16 departments balances at every hop |
| 6–8 | Disposition flows (rework/reject/hold/loss), FG dispatch, dashboards on aggregates, pagination | Reports match the ledger; nothing is stranded |
| 8–9 | Shop-floor UX hardening, Hindi labels, printing tests, security P1 items | UAT sign-off from each department incharge |
| 10–11 | Pilot on one order with paper in parallel; daily reconciliation | Two consecutive weeks with zero unexplained variance |
| 12 | Full rollout + training; delete the NestJS API and dead code | Paper retired |

## 7. Decisions needed from management

1. **Shared department logins vs. personal accounts.** Personal accounts are needed for a real audit trail.
2. **Go-live data strategy:** clean opening balance (recommended) or reconcile historical data.
3. **External job-work:** which departments, if any, are outside the premises. This drives the GST challan requirements.
4. **Hosting budget:** paid Vercel/Neon tiers with backups and no cold starts. Roughly the cost of one tablet per month.
5. **Team:** at least one developer dedicated to the domain core (4.1) for the whole 12 weeks.
