# AI Department Assistant — Architecture

**Status:** Design for approval. Not implemented. Companion to `PHASE-1-FINAL-AUDIT.md`.
**Approved shape:** Next.js chat interface → NestJS AI module → authentication and authorization → controlled read-only MES services → existing Neon PostgreSQL.

Labels: **VERIFIED** (from source), **ASSUMED**, **BLOCKED**, **RECOMMENDATION**.

---

## 1. Diagram

```
Browser (Next.js pages, same origin)
  │  httpOnly cookie subham_mes_token (set by /api/auth/login)
  ▼
Next.js proxy routes  frontend/src/app/api/assistant/*        ← RECOMMENDATION
  │  verifies cookie (middleware already does) and forwards the
  │  same token as Authorization: Bearer, server-to-server
  ▼
NestJS AI module  backend/src/modules/ai-assistant/           ← approved
  │  SessionAuthGuard → DepartmentScopeService → ToolRegistry
  │  → read-only services → Prisma (@shubham/database)
  │  → OpenAI API (function calling; tools only)
  ▼
Neon PostgreSQL (existing database; no new database)
```

Why a Next.js proxy in front of NestJS (RECOMMENDATION):

- The session cookie is httpOnly and scoped to the Next.js origin. A browser call straight to the Render NestJS origin would not receive it, and would need CORS credentials, which `backend/src/main.ts` currently sets to `origin: '*'` (finding A2). Routing through Next keeps the browser same-origin, matching every existing page (`frontend/src/lib/api.ts`).
- The proxy adds no authority. It forwards the token; NestJS verifies it itself (Section 4).

Alternative (not recommended): the browser calls NestJS directly with a Bearer token. This needs a CORS fix, puts a token in JavaScript, and bypasses the existing cookie flow.

---

## 2. Components

| Component | Path | Responsibility | New / modified |
|---|---|---|---|
| Launcher and panel | `frontend/src/components/assistant/` | Floating button, conversation list, message view, composer | New |
| Layout mount | `frontend/src/app/layout.tsx` | Render the launcher once | Modified (one element) |
| Proxy routes | `frontend/src/app/api/assistant/**/route.ts` | Verify cookie, forward to NestJS, return JSON | New |
| AI module | `backend/src/modules/ai-assistant/` | Everything server-side | New |
| Module registration | `backend/src/app.module.ts` | Import `AiAssistantModule` | Modified (one line) |
| Schema | `packages/database/prisma/schema.prisma` | Six `Ai*` models | Modified (additive) |
| Migration | `packages/database/prisma/manual-migrations/<date>_ai_assistant.sql` | Create tables, idempotent | New |
| Migration runner | `scripts/apply-appearance-migrations.js` | Register the new file | Modified (one entry) |
| Shared rules | proposed package (see Section 7) | Pure calculation modules used by both apps | Modified (move; owner approval) |

---

## 3. NestJS AI module structure (proposed)

```
backend/src/modules/ai-assistant/
  ai-assistant.module.ts
  ai-assistant.controller.ts          POST /ai/conversations, GET/PATCH/DELETE /ai/conversations/:id,
                                      POST /ai/conversations/:id/messages, POST /ai/feedback
  guards/session-auth.guard.ts        verifies Next session token (Section 4)
  scope/department-scope.service.ts   builds the caller's scope from the database (Section 4.3)
  scope/department-map.ts             one map of department key → codes (shared with Next)
  tools/tool-registry.ts              the twelve tools: name, input schema, allowed scopes, row cap
  tools/*.tool.ts                     read-only query services (Section 6)
  llm/openai.client.ts                HTTP client, timeout, retry policy, no key logging
  llm/prompt.ts                       system prompt
  conversations/conversation.service.ts  owner-scoped persistence
  logging/audit.service.ts            AiAuditLog writes (argsHash, never raw secrets)
  logging/usage.service.ts            AiUsageLog writes; daily cap check
  limits/rate-limit.service.ts        per-user limits from AiUsageLog counts
  dto/*.ts                            request validation (class-validator is not installed; use zod, already a dependency of backend)
```

Dependencies (VERIFIED): `@nestjs/common`, `@nestjs/core`, `@nestjs/jwt`, `@nestjs/passport`, `@shubham/database`, `@shubham/validation`, `zod`, `bcryptjs` are already in `backend/package.json`. **No new npm dependency is required if OpenAI is called over HTTP with Node's built-in `fetch`** (Node 18+ is required; the project's Node version is ASSUMED to be ≥ 18, to be checked in `render.yaml` build settings — `render.yaml` does not pin a Node version).

---

## 4. Authentication and authorization bridge

### 4.1 The problem (VERIFIED)

- The live app signs users in through Next.js and issues HS256 tokens signed with `AUTH_SECRET` (`frontend/src/lib/auth/session-token.ts`).
- NestJS signs its own tokens with `JWT_SECRET` through `AuthService.login`, which accepts only username or email and ignores station names and PINs (`backend/src/modules/auth/auth.service.ts`). **NestJS login cannot correctly sign in the accounts the live app uses.**
- The NestJS role guards depend on tables emptied by `20261102_remove_roles.sql`.

So the NestJS AI module must **not** use NestJS login or `JwtAuthGuard`/`RolesGuard`/`PermissionsGuard`.

### 4.2 Chosen mechanism (RECOMMENDATION)

**Verify the same session token the live app issues.**

1. The browser holds only the Next.js cookie (unchanged).
2. A Next.js proxy route reads the cookie server-side and calls `POST {AI_SERVICE_URL}/ai/...` with `Authorization: Bearer <token>`. It sends nothing else from the browser except the message body.
3. `SessionAuthGuard` in NestJS:
   a. Reads the bearer token. Rejects if missing.
   b. Verifies the HS256 signature with the shared secret (`AUTH_SECRET`, see Q-note below), checks `alg === HS256`, checks `exp`. Rejects otherwise.
   c. Loads `User` by `sub` through Prisma. Rejects unless `isActive === true`.
   d. Attaches to the request: `{ userId, username, departmentCode (from DB), isAdmin (from DB) }`. It attaches **nothing** from the token's `dept`, `role` or `roles` claims.
4. Every request is re-authenticated, so revocation (deactivation) takes effect on the next message.

**Shared secret.** Both services must verify with the same key. Options:

- **Option S1 (recommended):** set the same value of `AUTH_SECRET` on the NestJS service as on the Next service. The token format stays identical. Requires owner to copy the existing secret value into the Render environment for NestJS (credential item, Section 10). **BLOCKED until U4 is answered.**
- **Option S2:** a new AI-specific secret. Next signs a short-lived (60 s) assertion from the verified session; NestJS verifies that. More moving parts, but the long-lived session secret never leaves the Next service.

**Gateway key (optional, RECOMMENDED):** a second header `X-Gateway-Key` set by the proxy from an environment secret, so the NestJS endpoint refuses calls that bypass Next. Defence in depth; the token check already prevents identity forgery.

### 4.3 Department scope (VERIFIED rules; RECOMMENDATION for enforcement)

Scope is computed **only** on the server, from the database, on every request:

```
scope = {
  userId,
  isAdmin:  adminFlagFromDatabase(user),          // see 4.4
  departmentKey: departmentKeyFor(user.departmentCode),   // null if unknown
}
```

- `departmentKeyFor` uses the same alias map as the live app (`frontend/src/lib/auth/department-access.ts`, `DEPARTMENT_ACCESS`). This map must be moved to a shared package so both services use the same codes (Section 7).
- A user with `departmentKey = null` and `isAdmin = false` gets no MES data: every tool returns "no access".
- **Never** use `sessionDepartment` (username-derived, finding A3), the token's `dept` claim, or any request header such as `x-user-department`.
- Each tool applies `scope` inside its own query. A department filter in the request body is only honoured for admins, and only as a narrowing filter.

### 4.4 Admin (VERIFIED defect; RECOMMENDATION)

- Today `isAdmin` is derived from the username `admin` (finding A3) as well as `departmentCode = 'ADMIN'`.
- Until Q8 is resolved, the AI module treats **only** `User.departmentCode === 'ADMIN'` as admin, and does not read the username at all.
- Q8 proposes a database-controlled flag (migration with a new column or a dedicated role row). Until it exists, the owner must confirm which accounts are admin.

### 4.5 Conversation ownership (RECOMMENDATION; owner requirement)

- Every conversation row carries `userId`. Every query filters on `userId = scope.userId`.
- Admin scope does **not** widen conversation access. Admin can see MES data across departments, but not another employee's conversations.
- A request for another user's conversation returns 404 (not 403), so IDs cannot be probed.

### 4.6 Revalidation on each message (RECOMMENDATION; owner requirement)

Each `POST .../messages` repeats Section 4.2 and 4.3 before the model is called and before each tool call. Tool results are checked against scope again inside the tool. A revoked or re-departmented user is refused on the next message, even inside a saved conversation.

### 4.7 What the proxy does not do

- It does not read request body fields to decide access.
- It does not cache identity. Each call is authenticated.
- It does not return NestJS error stacks; it maps errors to fixed messages.

---

## 5. Request flows

### 5.1 Ask a question (happy path)

1. Client posts `{ conversationId, text }` to `/api/assistant/conversations/:id/messages`.
2. Proxy forwards to NestJS with the bearer token.
3. `SessionAuthGuard` authenticates; `DepartmentScopeService` builds scope.
4. Conversation service confirms `conversation.userId === scope.userId` and status not archived.
5. Rate and cost limits checked (`AiUsageLog` counts). Fail → 429 / 403 with reason; audit `DENIED`.
6. User message saved (`AiMessage` role `USER`).
7. Model call with system prompt, conversation context (last N messages, trimmed), and tool schemas only.
8. For each tool call requested by the model: validate arguments with zod; run the tool with scope; cap rows; reduce fields; save `AiAuditLog` (`TOOL_CALL`, `argsHash`, `resultCount`) and `AiMessageSource` rows; return a `TOOL` result to the model.
9. Model produces the final answer. Save `AiMessage` role `ASSISTANT`, with `model` name. Save `AiUsageLog` (tokens, estimated cost, latency).
10. Response to the proxy, then to the browser.

### 5.2 Failure paths

- OpenAI timeout or 5xx: one retry for 429/5xx; then a fixed message; usage row `status = ERROR`. No partial tool results are shown as an answer.
- NestJS unavailable: the proxy returns a fixed message. The browser does not fall back to any direct database access.
- Tool error (invalid input, no access, no rows): the tool returns a structured reason; the model must report it, not guess.

---

## 6. Tool contract (read-only)

Every tool:

- is registered in `tool-registry.ts` with a zod input schema, the set of allowed department keys (or "admin-only"), and a row cap (default 50, maximum 50; history tools also require a date range of at most 90 days);
- performs only `findMany`, `findFirst`, `findUnique`, `count` or `aggregate` through Prisma;
- returns a typed object with fixed fields. It never returns `passwordHash`, `email` of other users, `metadataJson`, `idempotencyKey`, `attachments` or image bytes;
- returns quantities as `{ value: number, unit: 'MTR' | 'PCS' | 'MIXED' | null, source: string }`, one object per unit;
- returns `null` quantities as `null` with a reason, never `0`.

| Tool | Input (zod) | Output | Scope rule | Service |
|---|---|---|---|---|
| `get_department_summary` | `{ departmentKey?: enum }` (admin only for other keys) | Counts by status for the department: awaiting, in progress, completed, on hold | own department; admin: any | `DepartmentWorkItem`, `DepartmentHold` reads |
| `search_challans` | `{ challanNumber?, status?, fromDept?, toDept?, from?, to?, limit ≤ 50 }` | Header rows: number, status, from/to, dates, sheet number | sender or receiver = own | `Challan` read |
| `get_challan_details` | `{ challanId }` | Header, lines (quantity + uom), events (no metadata JSON) | sender or receiver = own | `Challan`, `ChallanItem`, `ChallanEvent` |
| `get_production_sheet_details` | `{ programNumber }` | Sheet fields that the production sheet screen shows (no `metadataJson`) | sheet has work in own department | `Program` |
| `get_design_history` | `{ designNumber, limit ≤ 50 }` | One row per sheet (never merged) | sheets with work in own department | `Program` |
| `get_pending_work` | `{ stage?, limit ≤ 50 }` | Items: expected, received, processed, uom | own department | `DepartmentWorkItem` |
| `get_completed_work` | `{ from, to (≤ 90 days), limit ≤ 50 }` | Items finished in range with passed / rejected / rework | own department | `DepartmentWorkItem`, `WorkItemInspection` |
| `get_overdue_work` | `{ limit ≤ 50 }` | Items past due date with days late | own department | `DepartmentWorkItem`, `Program.deliveryDate` |
| `get_qc_history` | `{ stage?, from?, to?, limit ≤ 50 }` | Inspection batches: inspected, pass, reject, rework, outcome | own QC department | `WorkItemInspection`, `QualityInspection` |
| `get_hold_records` | `{ holdNumber? , status?, limit ≤ 50 }` | Holds: reason, held, released, remaining, unit | hold's department = own | `DepartmentHold`, `DepartmentHoldRelease` |
| `get_stock_summary` | `{ fabricName?, colour?, system: 'ROLL' \| 'LEDGER' }` | Totals per unit, labelled with the system | `STORE`, `DYEING`; admin: all | `FabricStoreRoll`, `FabricInward`, `FabricStockLedger` |
| `get_inventory_packing_summary` | `{ programNumber?, limit ≤ 50 }` | Garments in PCS: in stock, sent for packing, packed, returned | `INVENTORY`; admin: all | `PackingAllocation`, `StockLedgerEntry` |

Rules that apply to all tools:

- **No write tools.** The registry has no entry that writes. A test scans the tool folder (T29).
- **No model-generated SQL.** Inputs are typed fields only.
- **Unit discipline.** No tool adds MTR to PCS. `MIXED` is reported as a count of lines per unit, not a total.
- **Ordering and paging** are fixed server-side; the model cannot change `take` above the cap.

---

## 7. Shared rules (required to avoid duplicated business logic)

The live app's calculation rules are in `frontend/src/lib/*.mjs` (`challan-units.mjs`, `holds.mjs`, `inventory.mjs`, `work-items.mjs`, `fabric-stock-rules.mjs`). NestJS cannot import them directly (the frontend lib is ESM `.mjs` inside a Next.js project, and the NestJS build is CommonJS `tsc`).

Options:

1. **Move the pure modules into a shared package** (for example `packages/rules`, built like the existing `packages/config`). Both Next and NestJS import from it. Single source of truth. **Modifies existing imports in the frontend.** Requires owner approval and a regression check of every department page. **RECOMMENDATION.**
2. Copy the needed functions into NestJS. Duplicates logic. Rejected: the existing requirement is not to duplicate business logic.
3. Use only database aggregates in NestJS and skip the rules. Rejected: the rules include unit and hold handling that the screens depend on, so totals would not match the screens.

The shared package must also hold the department alias map (`DEPARTMENT_ACCESS` codes), so scope is computed the same way in both services.

---

## 8. Data flow for each department (summary)

Detail per department is in `PHASE-1-FINAL-AUDIT.md` §7. Pattern:

```
department key (from DB) → alias map → allowed codes
  → tool query with where { departmentCode in codes } or sheet/challan membership
  → rows (capped, fields whitelisted)
  → unit-separated totals computed by shared rule modules
  → model receives rows as data; answer cites source records
```

---

## 9. Non-functional requirements (RECOMMENDATION)

| Area | Requirement |
|---|---|
| Latency | First token under ~6 s typical. Tool calls ≤ 2 s each. Cold-start of a free-tier Render service may add delay (ASSUMED; service plan is `free` in `render.yaml`). |
| Availability | Assistant failure must not affect MES pages. The AI module has no shared state with the existing modules. |
| Scale | Small: tens of users. Sized for the factory's staff; no caching layer needed initially. |
| Cost | Hard daily cap per user and global, configurable. |
| Observability | Structured logs without secrets; counts per tool; error classes. |
| Feature switch | `AI_ASSISTANT_ENABLED` (off by default). When off, routes return 404. |

---

## 10. External credentials and configuration (names only)

| Name | Service | Purpose | Notes |
|---|---|---|---|
| `AUTH_SECRET` | NestJS (new) | Verify session tokens (Option S1) | Same value as Next. Owner must provide. Never commit. |
| `OPENAI_API_KEY` | NestJS | Model calls | Owner provides. |
| `OPENAI_MODEL` | NestJS | Model name | Owner chooses (Q11). |
| `AI_ASSISTANT_ENABLED` | NestJS and Next | Feature switch | Default off. |
| `AI_DAILY_COST_CAP_USD` | NestJS | Spending limit | Owner sets. |
| `AI_SERVICE_URL` | Next | Where the proxy sends requests | Render URL of the NestJS service. |
| `AI_GATEWAY_KEY` | Next and NestJS | Optional gateway check | Generated; owner stores. |
| `ASSISTANT_DATABASE_URL` | NestJS | Optional read-only PostgreSQL role (Section 11) | Owner creates the role. |

---

## 11. Database access model (RECOMMENDATION)

- The NestJS AI module uses the same `DATABASE_URL` through `@shubham/database` by default.
- **Recommended hardening:** a dedicated PostgreSQL role for the AI module: `SELECT` on MES tables; `SELECT, INSERT, UPDATE, DELETE` only on the six `Ai*` tables. The AI module's Prisma client then cannot write MES data even if a bug exists. This requires an owner-run `CREATE ROLE` and grants, and a second Prisma client instance in NestJS.
- The model never receives any connection string.

---

## 12. Open architectural risks

| ID | Risk | Mitigation |
|---|---|---|
| R-A1 | Render NestJS service may expose unauthenticated writes (finding A1) | Fix before deploying the AI module to the same service, or deploy the AI module only after A1 is fixed. |
| R-A2 | CORS `*` with credentials on NestJS | Not used by this design (same-origin proxy). Fix anyway in the A1 pass. |
| R-S1 | Shared secret value must match across services | Owner check (U4); use a single documented secret name. |
| R-R1 | NestJS role guards dead; if any AI route used them it would fail closed (deny) | AI module uses none of them. |
| R-Q1 | Two stock systems (Q1) | Labelled output; no merged number. |
| R-Q2 | Quantity defects (R3, R4, R7) | Disclose; fix in the existing workflow stage, not in the assistant. |
| R-Q3 | QC transfer challans (Q4) | Labelled "transfer challan". |
| R-D1 | Usernames not unique (A3) | Scope never uses usernames. |
