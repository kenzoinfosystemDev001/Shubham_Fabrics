# Smart Deadline Alerts

Deadline alerts for open department work. Enabled for **Dyeing** only; QC 1, Embroidery and
Thread Cutting are configured but switched off.

## How it works

- **Deadline**: the production sheet's delivery date (`Program.deliveryDate`). When a sheet is
  saved without a delivery date, the server still stores its 14-day fallback but marks
  `metadataJson.deliveryDateDefaulted = true`, and alerts treat that sheet as having **no
  deadline** (listed under "open jobs without a delivery date"). Sheets saved before this change
  carry no marker; their stored date is used as entered.
- **Open work (Dyeing)**: `DyeingOrder.status` in RECEIVED, IN_DYEING, PARTIALLY_DYED, DYED,
  READY_FOR_QC1, with the program not COMPLETED / CANCELLED / CLOSED and the inbound challan not
  CANCELLED / CLOSED / REJECTED. SENT_TO_QC1 counts as finished for Dyeing.
- **Stages**: due within 7, 3 and 1 days, due today and overdue, counted in factory calendar
  days in `Asia/Kolkata` (override with `FACTORY_TIME_ZONE`). Thresholds live in
  `apps/web/src/lib/deadline-alerts/config.ts`.
- **Dedup**: `DeadlineAlert.dedupKey` = `DEPT:ENTITY_TYPE:ENTITY_ID:STAGE:DEADLINE_DAY` (unique).
  Re-running never duplicates. A new stage or a changed deadline gives a new key; the previous
  alert is resolved (SUPERSEDED / DEADLINE_CHANGED). Closed work resolves its alerts
  (COMPLETED / CANCELLED / CLOSED). Alerts are never deleted.
- **Dismiss**: per user, stored in `DeadlineAlertDismissal` (+ an `AuditLog` entry). It changes
  nothing else. A dismissed alert comes back only at the next stage or after a deadline change.
  Overdue alerts stay listed as "Acknowledged" after dismissal.
- **Access**: `/api/alerts?department=X` requires membership of X's recipient departments
  (administrators always pass). Dismissing another department's alert returns 404.

## Scheduling

`apps/web/vercel.json` runs `GET /api/cron/deadline-alerts` daily at 18:05 UTC (00:05 IST),
which works on every Vercel plan. On a Pro plan it can run hourly (`5 * * * *`). The route
accepts `Authorization: Bearer $CRON_SECRET` (set `CRON_SECRET`, 16+ characters, in the Vercel
project; Vercel Cron sends it automatically) or an administrator session for a manual run.
Opening a department dashboard also runs the same idempotent pass for that department, so
status and deadline changes show up right away.

No email, SMS or push is sent.

## Database

Additive only: `packages/database/prisma/manual-migrations/20261024_deadline_alerts.sql`
(two tables, indexes, FKs). It matches what `npm run db:push` would apply to the current DB.
Apply it before deploying the code.

## Enabling another department

Set `enabled: true` on its entry in `DEPARTMENT_ALERTS` (`config.ts`) and check its open
statuses. The QC 1, Embroidery and Thread Cutting dashboards already render
`<DeadlineAlertsPanel>`, which stays hidden while the department is disabled; the cron run
picks up enabled departments automatically. A new department needs its own config entry and
panel.

## Tests

`node --test scripts/test-deadline-alerts.mjs`: date, threshold and dedup rules, plus the
engine itself run against an in-memory Prisma stand-in (no database).
