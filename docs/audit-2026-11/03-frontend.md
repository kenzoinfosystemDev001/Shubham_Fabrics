# 03 — Frontend Audit (Stage 1, §3.4)

Scope: `apps/web/src` (Next.js 15 App Router), branch `fix/mes-production-readiness`. This was a read-only static review. No dev server was started and no database was touched. All paths below are relative to `apps/web/src`.

## Summary

The newer **workflow layer** is in good shape. It covers `components/workflow/*`, `components/challan/*`, `components/hold/*`, the dyeing `my-work` screens, `Qc1DecisionModal` and `EditChallanDialog`:
- One shared `fetchJson` helper (`components/workflow/WorkflowUi.tsx:234-239`) throws when `res.ok` is false.
- Submit buttons are disabled while a request is in flight.
- Issue and inspect calls send an `idempotencyKey`.
- The request fields match what the route handlers read. I checked receive, issue-QC-challan, process PATCH and item inspections line by line.

The problems are in the **older pages and dashboards**:
1. **No error or loading boundaries at all.** The tree has 0 `error.tsx`, 0 `global-error.tsx` and 0 `loading.tsx` files.
2. **Failures look like "no data".** Many dashboards and lists swallow fetch failures (`.catch(() => [])`, unchecked `res.json()`, empty `catch {}`), so supervisors see zeros or empty boards instead of an error.
3. **Placeholder values are written to the database or printed.** Examples: fabric average `1.25`, quantity `1`, `'Standard'`, `'Cotton'`, `'CH-0000'`, `'Standard Client'`.
4. **Some legacy actions do not reconcile with the server or allow duplicates.** The Wilcom photo upload shows success optimistically. The QC1 inspection has no idempotency key and its route has a check-then-act race. GRN and roll-QC re-enable their submit buttons before redirecting.
5. **Page access is enforced only in the browser.** `DepartmentGuard`/`rbac.ts` decide from `localStorage` (and can build a user from display-hint cookies). The middleware enforces only authentication plus `/admin`, so department pages are not protected server-side. API routes are the real boundary: 46 of 211 route files call `requireDepartment`, and 26 call only `requireUser`.
6. **Heavy duplication and very large files.** There are 15 near-identical `*Navigation.tsx` files (4,134 LOC) and a 2,824-line page.

No hardcoded demo or mock record arrays were found. `localStorage`/`sessionStorage` is used only for the session-profile cache, theme and navigation context. No quantity is read from browser storage.

## Findings

| ID | Sev | Page/component | Evidence | Problem | User impact | Fix |
|---|---|---|---|---|---|---|
| FE-01 | High | All routes | `find app -name error.tsx` → 0; `loading.tsx` → 0; no `global-error.tsx`; no `ErrorBoundary` anywhere; `app/layout.tsx:53-60` | No route-level error boundary or suspense fallback. Any render exception (for example, malformed `metadataJson` reaching the UI) unmounts the whole tree. | Shop-floor user gets a blank or "Application error" screen mid-shift with no retry. | Add `app/global-error.tsx`, `app/error.tsx` and per-department `error.tsx` with a Retry button. Add `loading.tsx` for the heavy routes. |
| FE-02 | High | Dashboards: `/admin`, `/floor-board`, `/programming`, `/fabric-store/floor-board`, Fabric Store incoming challans | `app/admin/page.tsx:142-147` (`r.json()` with no `r.ok`, `.catch(() => [])`); `app/floor-board/page.tsx:39-40`; `app/programming/page.tsx:48-50`; `app/fabric-store/floor-board/page.tsx:30-32`; `app/fabric-store/my-work/incoming-challans/page.tsx:40-66` (`catch { setChallans([]) }`, no `res.ok`) | Fetch failures, 401/403/500 responses and timeouts are converted to empty arrays. No error banner is shown. | The board shows "0 Challans" or empty lanes during an outage, and supervisors conclude there is no work. Wrong operational decisions. | Use `fetchJson`. Keep the last good data plus an error banner. Never map a failure to `[]`. |
| FE-03 | High | `DepartmentStockView` (used by Dyeing Received, Store Stock, QC1, every `WorkReceived`) | `components/DepartmentStockView.tsx:46-58` (`if (json.success && json.data)` else silently nothing); `:96-108` default summary of all zeros | On a failed stock load the panel renders "0 MTR on hand / 0 in transit" from a hardcoded zero summary. | On-hand stock is shown as zero. A stores or QC person may re-order or stop work. | Show an error state. Do not render the zero default unless `data` came from the server. |
| FE-04 | High | Create Production Sheet | `app/my-work/create-production-sheet/page.tsx:1521` `fabricAverage: primaryAvg > 0 ? primaryAvg : 1.25`; `:1526` `colorQuantity: primaryPieces > 0 ? primaryPieces : 1`; `:1518` `serialNoCounter ... \|\| '000'` | Fabricated defaults are **persisted** to the program record. | Fabric requirement is computed from an invented 1.25 average, and quantities show 1 instead of "missing". This corrupts planning and reports. | Send `null` and let the server reject or keep blank. Show "not set" in the UI. |
| FE-05 | High | Program detail: Wilcom photo upload | `app/programs/[id]/page.tsx:741-757` | Optimistic `setProgram(photo)`, then `fetch(PATCH)` with `res.ok` ignored and the error only `console.warn`'d. The route requires `PROGRAMMING` (`app/api/programs/[id]/route.ts:302`), but the upload control is shown to every viewer (`:727-734`). | Non-Programming users (and anyone when the request fails) see the photo "saved". It disappears on reload. | Check `res.ok`, revert on failure, and hide the control unless the user is Programming. Reload from the server response. |
| FE-06 | High | QC1 inspection (legacy page) | `app/qc1/my-work/page.tsx:474-478` (no `idempotencyKey`); route `app/api/qc1/challans/[id]/inspect/route.ts:66` status check **outside** `$transaction` (`:243`), and `tx.challan.update({ where: { id } })` at `:472` has no status condition | The only protection against duplicates is the client's disabled button (`:2076`). Two tabs or a network retry can record two inspections. | QC quantities (pass/rework) can be double-counted and challans duplicated. | Send `idempotencyKey` as `WorkInspection` does (`components/workflow/WorkInspection.tsx:272`). Make the server do a conditional `updateMany({ where: { id, status: { in: [...] } } })` inside the transaction. |
| FE-07 | Medium | GRN create, roll QC | `app/fabric-store/my-work/material-receipt/create/page.tsx:149-189` (`finally setLoading(false)` before the redirect timer of 1.2 s; no idempotency key); `app/fabric-store/my-work/qc-inspections/[rollId]/page.tsx:81-106` (same pattern) | The button re-enables for 1.2 s after success. A second click creates a duplicate GRN. Roll QC is protected server-side by a status check. | Duplicate GRN, so inflated inward stock. | Keep the button disabled after success. Add an `idempotencyKey` to the GRN route. |
| FE-08 | Medium | Receipt dialogs (every workflow department except Final QC, plus Dyeing) | `components/challan/ReceiptLines.tsx:37-43` prefills received = sent unless `blank`; `components/workflow/WorkIncoming.tsx:348`; `lib/workflow-views.ts:197` (only `FINAL_CHECK` has `strictReceipt`); `app/dyeing/my-work/incoming/page.tsx:303`; QC1 inspection prefills inspected = passed = sent (`app/qc1/my-work/page.tsx:339-345`) | One click confirms the dispatched quantity without a physical count. | Shortages are never recorded, and WIP and loss reports become optimistic. | Turn on `strictReceipt` (blank entry) for receipt and inspection at all stations, or require an explicit "matches challan" tick. |
| FE-09 | Medium | Client RBAC | `lib/rbac.ts:15-51` (`getCurrentUser` from `localStorage`; fallback builds a user from the `subham_mes_role`/`subham_mes_dept` cookies, which `lib/auth/require-user.ts:143-145` sets as non-httpOnly "display hints"); `lib/rbac.ts:53-67` admin when `username === 'admin'`; `components/DepartmentGuard.tsx:115-125`; `middleware.ts:69-76` (server checks only `/admin`) | Department page access is decided entirely in the browser and can be changed by editing `localStorage`. The cookie fallback writes a fabricated profile (`id: 'cookie_session'`) back into storage. | Any signed-in user can open any department's screens (read-only exposure is limited by API checks). 26 API routes only call `requireUser`, so data is exposed to any department. | Enforce the department scope in middleware using the verified JWT `dept` claim. Drop the cookie-fallback user. Audit the 26 `requireUser`-only routes. |
| FE-10 | Medium | Printed challan | `lib/download-challan.ts:48-53, 67-68` (`'CH-0000'`, `FABRIC_STORE`→`DYEING`, `'ISSUED'`, today's date, `'STANDARD DESIGN'`, `'Standard Client'`); same pattern at `components/challan/ChallanPrintModal.tsx:53` | Missing fields print plausible fake values on a delivery document. | A misleading paper challan: wrong client, route or date on a legal and physical document. | Print "—" or block printing when required fields are missing. |
| FE-11 | Medium | Program detail item list | `app/programs/[id]/page.tsx:198-212` | When the program has no items, it shows a synthetic item: colour `'Standard'`, `fabricAverage: 1.25`, `specialMaterial: 'None'`. | The viewer sees invented spec values as if real. | Show an "No items recorded" empty state. |
| FE-12 | Medium | Programming → issue challan | `app/my-work/issue-challan/page.tsx:155-166` (`fabricIn` = `colorQuantity \|\| targetQuantity` (pieces) with `fabricUnit` defaulting to `'MTR'`; item fabric `'Cotton'`, colour `'Standard'`) | Pre-fills mix pieces with metres and invent fabric and colour. The values are editable, but the fallbacks look real. | A wrong unit or fabric issued on the challan if the user does not notice. | Leave blank; never assume MTR. |
| FE-13 | Medium | Legacy "Receive" button in `DepartmentStockView` | `components/DepartmentStockView.tsx:412-418` calls `PATCH /api/challans/:id/status RECEIVED`; the route refuses workflow-owned routes with 409 (`app/api/challans/[id]/status/route.ts:59-65`) | The button is shown on stock tabs of workflow departments (`components/workflow/WorkReceived.tsx:7`) even though the server always rejects it. It reports via `alert()`. | A dead-end action and confused operators. | Hide the button when the challan is workflow-owned (expose a flag from `/api/departments/stock`). |
| FE-14 | Medium | Fabric Store floor board counts | `app/fabric-store/floor-board/page.tsx:31` `rolls?limit=100`, `:94-96` filters client-side, `:143` shows the count | The "Defected" lane counts only defective rolls within the first 100 rolls of any status. | Undercounted quarantine stock. | Query `/api/fabric-store/rolls?status=QC_HOLD,REJECTED` server-side, or use the API total. |
| FE-15 | Medium | Unbounded list fetches | `app/api/challans/route.ts:~92` `findMany` with includes and no `take`; called by `app/admin/page.tsx:144`, `app/floor-board/page.tsx:40`, `app/programming/page.tsx:49`, `app/fabric-store/floor-board/page.tsx:30` | Each dashboard downloads every challan with relations, which grows with history. | Slow dashboards and timeouts (60 s client timeout, `lib/api.ts:44`), which then become empty boards (FE-02). | Paginate, or add count/summary endpoints. |
| FE-16 | Low | QC1 challan view barcode | `app/qc1/my-work/page.tsx:504-510` | `renderBarcodeSvg` draws decorative bars that do not encode the code. A real Code-128 generator exists (`lib/barcode.ts:51`, used in `components/workflow/WorkflowUi.tsx:223-228`). | An on-screen barcode that cannot be scanned. | Use `generateRawBarcodeSvg`. |
| FE-17 | Low | Admin "Wipe all data" | `app/admin/page.tsx:339-350` (prompt only, phrase not sent); `app/api/admin/clear-all-data/route.ts:9-13` | The confirmation phrase is checked only client-side. The server depends solely on the `destructiveAdminActionsDisabled()` env flag. The delete-all routes do require the phrase server-side. | One stray request wipes production data if the flag is unset. | Require `{confirm}` server-side, as delete-all does. Default the flag to disabled in production. |
| FE-18 | Low | Polling | `components/workflow/WorkFloorBoard.tsx:62`, `app/dyeing/floor-board/page.tsx:40`, `components/workflow/IssuedChallansTab.tsx:77,145` (60 s, two timers per tab) | No `visibilitychange` pause. Each poll sets `loading` (spinner flash). Cost is low per user, but the timers run in background tabs on floor PCs. | Minor server load. | Pause when hidden; refresh silently. |
| FE-19 | Low | Duplicated nav | 15 × `components/*Navigation.tsx` (210–367 LOC each, 4,134 total); for example, `WashingNavigation` vs `StitchingNavigation` differ by only 272 lines of a 285-line file, mostly labels | Each copy repeats the same profile sync, sign-out and cookie clearing (`components/WashingNavigation.tsx:30-66`). | A fix to one copy (for example sign-out) drifts from the others. | Make one config-driven `DepartmentNavigation`. |
| FE-20 | Low | Contract noise | See the contract list below | Fields are sent that the server ignores (`receiverId`, `inspectorId`, `actorName`), and `currentUser?.name` is read when the field does not exist. | Misleading code: the audit identity comes from the session, which is correct. | Remove the dead fields. |
| FE-21 | Low | Viewport | `app/layout.tsx:22-23` `maximumScale: 1, userScalable: false` | Pinch-zoom is disabled. | Accessibility and readability problem on tablets for small 9–11 px table text. | Allow zoom. |
| FE-22 | Low | Horizontal overflow | Tables without an `overflow-x-auto` wrapper: `components/dyeing/DyeingInstructions.tsx` (1/0), `components/workflow/WorkHistory.tsx` (3/1), `components/admin/QualityMonitorPanel.tsx` (7/4), `app/qc1/my-work/page.tsx` (3/2) | Possible page-level horizontal scroll on phones. | Minor. | Wrap the tables. |
| FE-23 | Low | Silent swallows (misc.) | `app/fabric-store/inventory/stock/page.tsx:36-41` (batch detail failure ignored); `app/fabric-store/my-work/incoming-challans/page.tsx:72-87` (availability toggle: `!res.ok` shows nothing); `app/programs/[id]/page.tsx:88-93` | The user clicks and nothing happens. | Confusion, and repeated clicks. | Surface the errors. |

## Large files (top 10 by LOC, excluding generated code)

| LOC | File |
|---|---|
| 2,824 | `app/my-work/create-production-sheet/page.tsx` |
| 2,114 | `app/qc1/my-work/page.tsx` |
| 1,575 | `lib/work-items-server.ts` |
| 1,524 | `app/admin/page.tsx` |
| 1,348 | `lib/download-production-sheet.ts` |
| 1,113 | `components/fabric-store/FabricStoreIssueChallanView.tsx` |
| 1,089 | `components/ColorFabricMeasurementTable.tsx` |
| 1,046 | `app/fabric-store/inventory/inward/page.tsx` |
| 969 | `components/inventory/InventoryScreens.tsx` |
| 959 | `app/programs/[id]/page.tsx` |

Note: `apps/web/src/generated/client` holds a committed Prisma client (`index.d.ts` is 199,783 LOC) inside the web source tree.

## localStorage / sessionStorage classification

| Key | Where | Use | Classification |
|---|---|---|---|
| `subham_mes_user` (local) | written by `app/login/page.tsx:106` and refreshed from `/api/auth/me` by every `*Navigation.tsx` (for example `components/Navigation.tsx:51`); read by `lib/rbac.ts:17`, `lib/api.ts:21`, `components/workflow/WorkIssueChallan.tsx:95`, `components/workflow/WorkProcess.tsx:62`, `components/inventory/InventoryUi.tsx:43`, `components/recutting/RecuttingStitchingChallan.tsx:87`, `app/qc1/my-work/page.tsx:290` and others | Display cache of the profile, client route gating and admin UI toggles | **Display cache: acceptable** for UI. **Not acceptable as the authorisation source** (FE-09). No quantities. |
| `subham_mes_user` written from cookies | `lib/rbac.ts:34-47` | Builds a fake profile from the non-httpOnly role/dept cookies | **Not OK.** A fabricated identity (`id: 'cookie_session'`) is persisted. |
| `subham_mes_token` (local), `mes_auth_token` (session) | Only `removeItem` (`lib/api.ts:29-30`, Navs) | Legacy cleanup; the token lives in an httpOnly cookie | OK (dead keys). |
| `subham_mes_theme` (local) | `components/ThemeContext.tsx:17,44` | Theme preference | OK. |
| `active_department`, `active_department_root` (session) | `components/DepartmentGuard.tsx:92-93,141`, `components/DepartmentSwitcher.tsx:264`, `components/admin/AdminDepartmentMenu.tsx:61`, read in `app/challans/[id]/page.tsx:81`, `app/programs/[id]/page.tsx:293` | Back-button containment and back-link target | OK (navigation context only). |
| `allow_login_after_back` (session) | `components/DepartmentGuard.tsx:149,170` | Navigation flag | OK. |

**No quantity, challan or stock value is read from browser storage.** Displayed quantities come from API responses. The exceptions are the hardcoded fallbacks in FE-03, FE-04, FE-10, FE-11 and FE-12.

## Client ↔ server contract check

The pairs below were verified field by field against the route handlers.

| Form → route | Result |
|---|---|
| `WorkIncoming` receive → `*/challans/[id]/receive` (`lib/work-items-server.ts:497-504`) | Match (`workItemId`, `receivedQuantity`, `receivedUnitQuantity`, `remarks`). |
| Dyeing receive → `app/api/dyeing/challans/[id]/receive/route.ts` | Match (`orderId` …). |
| Dyeing issue → `app/api/dyeing/qc-challans` → `lib/dyeing-qc-issue.ts:15-35` | Match, including `average`, `unitQuantity` and `width` via `lineExtrasOf`. |
| Dyeing process PATCH → `app/api/dyeing/orders/[id]/route.ts:32-73` | Match. |
| `WorkInspection` → `items/:id/inspections` (`lib/work-items-server.ts:810-834`) | Match, including `checkpoints`. |
| Fabric Store issue → `app/api/fabric-store/issue/route.ts:40` | Match. |
| GRN create → `app/api/fabric-store/grn/route.ts:84-95` | Match (but no idempotency, FE-07). |
| Roll QC → `app/api/fabric-store/qc/route.ts:72` | Match. |
| Manual outward → `app/api/fabric-store/outward/route.ts:330-344` | Match. |
| `DepartmentStockView` receive → `app/api/challans/[id]/status/route.ts:26-35` | Fields match, but the route 409s for workflow departments (FE-13). |
| QC1 receive → `app/api/qc1/challans/[id]/receive/route.ts:17` | `receiverId` is sent (`app/qc1/my-work/page.tsx:314`) and **ignored**; the session user is used. Harmless. |
| QC1 inspect → `.../inspect/route.ts:28-42` | `inspectorId` is destructured but the route uses the session `actorId` (`:210`). Harmless; no idempotency (FE-06). |
| Store availability → `app/api/fabric-store/check-availability/route.ts:62` | `actorName` is sent (`components/fabric-store/FabricStoreIssueChallanView.tsx:149`, `app/programs/[id]/page.tsx:115` using the non-existent `currentUser?.name`) and **ignored**; the server uses `authUser.fullName`. |
| `json.success` checks: `app/qc1/my-work/page.tsx:241`, `components/ColorFabricMeasurementTable.tsx:309`, `components/DepartmentStockView.tsx:50` | The routes do return `{ success, data }`, so they match. The issue is that the failure branch is silent (FE-03). |
| `/api/challans` GET returns a bare array (`app/api/challans/route.ts:139`); callers use `Array.isArray(x) ? x : x.data` | They tolerate it, but error objects silently become `[]` (FE-02). |

No button without a handler was found: a scan of every `<button>` without `onClick` or `type="submit"` turned up only false positives.

**Double-submit protection.** It is present on all issue, receive, inspect and complete actions checked: `WorkIssueChallan`, `WorkIncoming`, `WorkInspection`, `WorkProcess`, `Qc1DecisionModal`, `EditChallanDialog`, `HoldSection`, `RecuttingAllocation`, `ShrinkageRecords`, `FabricStoreIssueChallanView`, Create Production Sheet, Material Issue, QC1 receive and QC1 inspect. The weak spots are FE-06 and FE-07.

**Print and download paths.** `lib/download-challan.ts`, `lib/download-production-sheet.ts`, `lib/download-wilcom.ts` and `ChallanPrintModal` render from the challan or program object the page fetched from the API. They do not use local state, apart from the fabricated fallbacks in FE-10. `lib/print-window.ts` is only a print-when-loaded helper.

## Recommendations (priority order)

1. Add `global-error.tsx`, `error.tsx` and `loading.tsx` (FE-01). Replace every `.catch(() => [])` or unchecked `res.json()` on list and dashboard loads with `fetchJson` plus a visible error state (FE-02, FE-03, FE-23).
2. Remove all fabricated defaults that are persisted or printed (FE-04, FE-10, FE-11, FE-12). Missing must stay missing.
3. Give legacy writes the same idempotency and transactional status guard (FE-06, FE-07). Fix the optimistic Wilcom upload (FE-05).
4. Enforce the department scope in middleware from the verified session claims. Remove the `rbac.ts` cookie-fallback user (FE-09).
5. Make receipt and inspection quantities blank-entry by default, or require an explicit confirmation (FE-08).
6. Paginate `/api/challans` and the dashboard data, and use server counts (FE-14, FE-15).
7. Refactor: one configurable `DepartmentNavigation` (FE-19). Split the 2,800-line and 2,100-line pages. Move legacy QC1 and Fabric Store screens onto the shared workflow components.
8. Small cleanups: real barcode (FE-16), require the confirmation phrase server-side for the data wipe (FE-17), pause polling when the tab is hidden (FE-18), remove dead request fields (FE-20), allow zoom (FE-21).
