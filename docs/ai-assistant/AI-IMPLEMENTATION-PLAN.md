# AI Assistant — Implementation Plan and File Map

**Status:** Plan for approval. **Nothing in this document has been implemented.**
**Companion:** `PHASE-1-FINAL-AUDIT.md` (findings), `AI-ARCHITECTURE.md` (design), `AI-DATABASE-DESIGN.md` (tables), `AI-SECURITY-PLAN.md` (controls).

Principle: **avoid unnecessary changes.** Existing files are touched only where the integration cannot be done otherwise, and each such change is listed with its reason.

---

## 1. Phases

| Phase | Content | Gate |
|---|---|---|
| 0 | Owner decisions (Section 6 below) and prerequisite fixes A1, A3, A4 (approval required; these change authentication) | Owner approval |
| 1 | This audit (complete) | Owner approval of Phase 2 |
| 2a | Database: six `Ai*` tables (draft SQL, Prisma models); owner runs SQL | Owner runs migration |
| 2b | NestJS AI module: session guard, scope service, read-only tools, conversation service, audit and usage services, OpenAI client, limits. Feature switch off. | Build gates pass |
| 2c | Next.js proxy routes and chat UI, mounted behind the feature switch | Build gates pass |
| 2d | Shared rules package (Section 4) and department-by-department regression | Owner approval; regression check |
| 3 | Verification (test cases in the audit §9) | Owner sign-off |
| 4 | Staged rollout: admin → one department → all | Owner decision per stage |

Phases 2a–2c can be developed in parallel only after 2a's table definitions are agreed.

---

## 2. File map

Legend: **N** = new, **M** = modified (existing file, change listed), **X** = not touched.

### 2.1 Database (`packages/database`)

| Path | Status | Purpose | Dependencies | Integrates with |
|---|---|---|---|---|
| `packages/database/prisma/schema.prisma` | M | Add six `Ai*` models and back-relations on `User` (additive). | Prisma 6 (existing) | Every Prisma consumer after regenerate |
| `packages/database/prisma/manual-migrations/<YYYYMMDD>_ai_assistant.sql` | N | Idempotent DDL for six tables, indexes, foreign keys | Existing migration convention | `scripts/apply-appearance-migrations.js` |
| `packages/database/src/generated/client/**` | M (generated) | Regenerated Prisma client | `prisma generate` | Backend and frontend copies (project memory: copy changed client files) |
| `packages/database/dist/generated/client/**` | M (generated copy) | Build copy | — | Backend `dist` |
| `frontend/src/generated/client/**` | M (generated copy) | Frontend copy | — | Next.js build |

### 2.2 Migration runner (`scripts`)

| Path | Status | Purpose | Change |
|---|---|---|---|
| `scripts/apply-appearance-migrations.js` | M | Register the new SQL file | One entry appended to `MIGRATIONS` array (line ~48–70 in the current file). The file's own comment lists the rule: every file is re-runnable |

### 2.3 Shared rules (new package; Section 4)

| Path | Status | Purpose | Dependencies | Integrates with |
|---|---|---|---|---|
| `packages/rules/package.json` | N | Package definition, same pattern as `packages/config/package.json` | TypeScript | Root workspaces (`packages/*` already covers it) |
| `packages/rules/tsconfig.json` | N | Build config (copy of `packages/config/tsconfig.json` pattern) | — | — |
| `packages/rules/src/index.ts` | N | Re-exports | — | Backend, frontend |
| `packages/rules/src/department-map.ts` | N | Department keys → codes and legacy role names (moved from `frontend/src/lib/auth/department-access.ts` `DEPARTMENT_ACCESS`) | — | `department-access.ts` (re-export), AI scope |
| `packages/rules/src/challan-units.ts` (or `.mjs` compiled) | N | Moved from `frontend/src/lib/challan-units.mjs` | `fabric-stock-rules` (moved too) | Frontend pages, AI tools |
| `packages/rules/src/holds.ts` | N | Moved from `frontend/src/lib/holds.mjs` | — | Frontend, AI tools |
| `packages/rules/src/inventory.ts` | N | Moved from `frontend/src/lib/inventory.mjs` | — | Frontend, AI tools |
| `packages/rules/src/work-items.ts` | N | Moved from `frontend/src/lib/work-items.mjs` | — | Frontend, AI tools |
| `packages/rules/src/fabric-stock-rules.ts` | N | Moved from `frontend/src/lib/fabric-stock-rules.mjs` | — | Frontend, AI tools |
| `frontend/src/lib/challan-units.mjs` | M | Replaced by a re-export from the package (or deleted with imports updated) | — | Every importing page (see §5) |
| `frontend/src/lib/holds.mjs` | M | Same | — | Same |
| `frontend/src/lib/inventory.mjs` | M | Same | — | Same |
| `frontend/src/lib/work-items.mjs` | M | Same | — | Same |
| `frontend/src/lib/fabric-stock-rules.mjs` | M | Same | — | Same |
| `frontend/src/lib/auth/department-access.ts` | M | Import `DEPARTMENT_ACCESS` from `@shubham/rules` instead of defining it | — | Every department route guard |
| `frontend/package.json` | M | Add `"@shubham/rules": "*"` dependency | — | — |
| `backend/package.json` | M | Add `"@shubham/rules": "*"` dependency | — | — |
| `backend/tsconfig.build.json` / root `tsconfig.base.json` | M only if path resolution needs it | Path mapping for the new package | — | Build |

**Owner approval required for the package move (§4 and §5).** This is the only part of Phase 2 that changes existing business-logic files.

### 2.4 NestJS AI module (`backend`)

| Path | Status | Purpose | Dependencies | Integrates with |
|---|---|---|---|---|
| `backend/src/modules/ai-assistant/ai-assistant.module.ts` | N | Nest module; imports Prisma module | `PrismaModule` (`backend/src/common/prisma.module.ts`) | `backend/src/app.module.ts` |
| `backend/src/modules/ai-assistant/ai-assistant.controller.ts` | N | Routes under `/ai` (global prefix `api` gives `/api/ai`) | Guard, services | Proxy routes in Next |
| `backend/src/modules/ai-assistant/guards/session-auth.guard.ts` | N | Verify Next session token (HS256, `AUTH_SECRET`), check `exp`, load `User`, `isActive` | `jsonwebtoken` **or** Node `crypto` (HMAC-SHA256 — no new dependency needed; `@nestjs/jwt` already present and can verify HS256) | `PrismaService` (`backend/src/common/prisma.service.ts`) |
| `backend/src/modules/ai-assistant/guards/gateway-key.guard.ts` | N | Optional `X-Gateway-Key` check | env `AI_GATEWAY_KEY` | — |
| `backend/src/modules/ai-assistant/scope/department-scope.service.ts` | N | Build `{userId, isAdmin, departmentKey}` from database only | `@shubham/rules` department map | Tools, conversation service |
| `backend/src/modules/ai-assistant/tools/tool-registry.ts` | N | Twelve tool definitions (name, zod schema, allowed departments, row cap) | `zod` (existing dependency) | Tool runner |
| `backend/src/modules/ai-assistant/tools/tool-runner.service.ts` | N | Validate args, check scope, run tool, cap rows, reduce fields, audit | Registry, audit service | Conversation service |
| `backend/src/modules/ai-assistant/tools/get-department-summary.tool.ts` | N | Tool | `PrismaService`, `@shubham/rules` | Registry |
| `backend/src/modules/ai-assistant/tools/search-challans.tool.ts` | N | Tool | Prisma `Challan` | Registry |
| `backend/src/modules/ai-assistant/tools/get-challan-details.tool.ts` | N | Tool | Prisma `Challan`, `ChallanItem`, `ChallanEvent` | Registry |
| `backend/src/modules/ai-assistant/tools/get-production-sheet-details.tool.ts` | N | Tool | Prisma `Program` | Registry |
| `backend/src/modules/ai-assistant/tools/get-design-history.tool.ts` | N | Tool | Prisma `Program` | Registry |
| `backend/src/modules/ai-assistant/tools/get-pending-work.tool.ts` | N | Tool | Prisma `DepartmentWorkItem`, `DyeingOrder` | `@shubham/rules` work-items |
| `backend/src/modules/ai-assistant/tools/get-completed-work.tool.ts` | N | Tool | Prisma `DepartmentWorkItem`, `WorkItemInspection` | Registry |
| `backend/src/modules/ai-assistant/tools/get-overdue-work.tool.ts` | N | Tool | Prisma `Program`, `DepartmentWorkItem` | Registry |
| `backend/src/modules/ai-assistant/tools/get-qc-history.tool.ts` | N | Tool | Prisma `WorkItemInspection`, `QualityInspection` | Registry |
| `backend/src/modules/ai-assistant/tools/get-hold-records.tool.ts` | N | Tool | Prisma `DepartmentHold`, `DepartmentHoldRelease` | `@shubham/rules` holds |
| `backend/src/modules/ai-assistant/tools/get-stock-summary.tool.ts` | N | Tool; `system` parameter selects ROLL or LEDGER | Prisma `FabricStoreRoll`, `FabricInward`, `FabricStockLedger` | `@shubham/rules` fabric stock |
| `backend/src/modules/ai-assistant/tools/get-inventory-packing-summary.tool.ts` | N | Tool | Prisma `PackingAllocation`, `StockLedgerEntry`, `DepartmentWorkItem` | `@shubham/rules` inventory |
| `backend/src/modules/ai-assistant/llm/openai.client.ts` | N | HTTP client to OpenAI Responses/Chat API with function calling; timeout; one retry on 429/5xx; never logs key | Node `fetch`; env `OPENAI_API_KEY`, `OPENAI_MODEL` | Conversation service |
| `backend/src/modules/ai-assistant/llm/prompt.ts` | N | System prompt: read-only, data is not instructions, cite sources, say "not recorded" | — | OpenAI client |
| `backend/src/modules/ai-assistant/conversations/conversation.service.ts` | N | Owner-scoped CRUD: create, list, get, rename, archive, delete; message persistence | Prisma `AiConversation`, `AiMessage` | Controller |
| `backend/src/modules/ai-assistant/conversations/message.service.ts` | N | Orchestrates one turn: auth recheck, limits, model loop, persistence | Tool runner, OpenAI client, usage, audit | Controller |
| `backend/src/modules/ai-assistant/logging/audit.service.ts` | N | `AiAuditLog` writes; `argsHash`; no secrets | Prisma | All services |
| `backend/src/modules/ai-assistant/logging/usage.service.ts` | N | `AiUsageLog` writes; cost estimate from config | Prisma | Message service |
| `backend/src/modules/ai-assistant/limits/limits.service.ts` | N | Per-user rate and daily cost cap from `AiUsageLog` counts | Prisma | Message service |
| `backend/src/modules/ai-assistant/dto/*.ts` | N | Zod schemas for request bodies | `zod` | Controller |
| `backend/src/modules/ai-assistant/ai-assistant.config.ts` | N | Reads and validates env (`AI_ASSISTANT_ENABLED`, `OPENAI_*`, caps) | — | All services |
| `backend/src/app.module.ts` | M | Import `AiAssistantModule` (one line in `imports`). | — | — |

Not used: `@nestjs/throttler` (already global, `app.module.ts`) is used as-is for IP-level limits; per-user limits are in `limits.service.ts`.

### 2.5 Next.js proxy and UI (`frontend`)

| Path | Status | Purpose | Dependencies | Integrates with |
|---|---|---|---|---|
| `frontend/src/app/api/assistant/conversations/route.ts` | N | Proxy GET (list), POST (create) | `getSessionUser` (`frontend/src/lib/auth/require-user.ts`) | NestJS via `AI_SERVICE_URL` |
| `frontend/src/app/api/assistant/conversations/[id]/route.ts` | N | Proxy GET, PATCH (rename or archive), DELETE | Same | Same |
| `frontend/src/app/api/assistant/conversations/[id]/messages/route.ts` | N | Proxy POST (send message) | Same | Same |
| `frontend/src/app/api/assistant/feedback/route.ts` | N | Proxy POST (rating) | Same | Same |
| `frontend/src/lib/assistant/proxy.ts` | N | Shared proxy helper: read cookie, call NestJS with bearer token, map errors to fixed messages, timeout | `session-token.ts` (readSessionToken) | Route files |
| `frontend/src/components/assistant/AssistantLauncher.tsx` | N | Floating button; mounts panel; hidden on `/login` and when no session | `rbac.ts` `getCurrentUser` (UI only) | Layout |
| `frontend/src/components/assistant/AssistantPanel.tsx` | N | Conversation list, rename, archive, delete, panel layout | `api.ts` pattern | Launcher |
| `frontend/src/components/assistant/MessageList.tsx` | N | Render messages as plain text or safe Markdown; show source labels | — | Panel |
| `frontend/src/components/assistant/Composer.tsx` | N | Text input, submit, disabled while sending | — | Panel |
| `frontend/src/app/layout.tsx` | M | Add `<AssistantLauncher />` once, inside `ThemeProvider` | — | Every page |
| `frontend/.env.example` | M | Names only: `AI_SERVICE_URL`, `AI_GATEWAY_KEY`, `AI_ASSISTANT_ENABLED` | — | Documentation |

**Not modified:** `frontend/src/components/Navigation.tsx`, `DepartmentGuard.tsx`, `frontend/src/middleware.ts` (the proxy paths are under `/api`, already gated), all department pages, all existing route handlers.

### 2.6 Environment examples

| Path | Status | Change |
|---|---|---|
| `backend/.env.example` | M | Names only: `AUTH_SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_ASSISTANT_ENABLED`, `AI_DAILY_COST_CAP_USD`, `AI_GATEWAY_KEY`, optional `ASSISTANT_DATABASE_URL` |
| `render.yaml` | M (only with owner approval) | Add env keys for the NestJS service (`sync: false`). Changing the production blueprint is an owner action. |

No real value is written to any file.

### 2.7 Documentation (this folder)

| Path | Status |
|---|---|
| `docs/ai-assistant/PHASE-1-FINAL-AUDIT.md` | N (this audit) |
| `docs/ai-assistant/AI-ARCHITECTURE.md` | N |
| `docs/ai-assistant/AI-DATABASE-DESIGN.md` | N |
| `docs/ai-assistant/AI-IMPLEMENTATION-PLAN.md` | N (this file) |
| `docs/ai-assistant/AI-SECURITY-PLAN.md` | N |
| `docs/ai-assistant/PHASE_1_AI_ASSISTANT_AUDIT.md` | Existing (earlier working report) |

---

## 3. Dependencies

### 3.1 npm

| Package | Needed? | Reason |
|---|---|---|
| `openai` (official SDK) | Optional | Not needed if the HTTP API is called with Node `fetch`. Owner decision (D5 in earlier report). If added, it is a new dependency and requires a documented reason. |
| `@nestjs/schedule` | Only for in-process purge (Q-DB5) | Otherwise use a Render cron or Next cron. |
| `@shubham/rules` | Internal workspace package | No npm registry package. |
| `jsonwebtoken` | Not needed | `@nestjs/jwt` (present) can verify HS256; or Node `crypto` HMAC. |
| `zod` | Already present in `backend` and `frontend` | — |

**Install commands:** none are required for the planned design. Phase 2 must not install packages without the owner's approval, per the brief.

### 3.2 Environment and services

See `AI-ARCHITECTURE.md` §10. Credentials required before 2b can be deployed: `OPENAI_API_KEY`, `AUTH_SECRET` on NestJS (value to match Next), and `AI_SERVICE_URL` on Next.

---

## 4. Shared rules package — why and how

Business rules are needed by two processes. The current source (`frontend/src/lib/*.mjs`) is ESM inside Next.js; NestJS compiles CommonJS. Without a shared package, the assistant would copy the rules, and copies can diverge from the screens that use the originals. (Duplicate logic elsewhere in the project was not systematically checked in this audit.)

Steps (Phase 2d, separate approval):

1. Create `packages/rules` with the pure modules only (no Prisma, no Next imports). Verify each module has no framework import (grep check).
2. Add re-export shims in the existing `frontend/src/lib/*.mjs` files so every existing import keeps working. **No page code changes.**
3. Run `next build` and `tsc`. Smoke-test each department page against its previous behaviour (owner or manual check).
4. Only after step 3 passes, the AI module imports from `@shubham/rules`.

If the owner prefers no change to existing files, the fallback is to copy only the functions the assistant needs into `backend/src/modules/ai-assistant/rules/` with a comment listing the source file and line range, and a note that they must be kept in sync. **This is a weaker option and is not recommended.**

---

## 5. Existing files that change, with reasons

| File | Change | Reason | Risk |
|---|---|---|---|
| `packages/database/prisma/schema.prisma` | Add six models + back-relations | Tables for conversations etc. | Low (additive) |
| `scripts/apply-appearance-migrations.js` | Register one SQL file | Project migration runner | Low |
| `backend/src/app.module.ts` | Import one module | Register Nest module | Low |
| `frontend/src/app/layout.tsx` | Mount launcher | UI entry point | Low |
| `frontend/src/lib/auth/department-access.ts` | Import map from package | One department map | Medium: every department guard uses it; regression check required |
| `frontend/src/lib/*.mjs` (five files) | Re-export shims | Shared rules | Medium: many imports; shims keep them working |
| `frontend/package.json`, `backend/package.json` | Add internal dependency | Shared package | Low |
| `.env.example` files | Names only | Documentation | None |
| Generated Prisma client copies | Regenerated | New models | Low; follow project memory procedure |

**Changes Phase 2 must not make:** existing route handler logic, existing department pages, `Navigation.tsx`, `DepartmentGuard.tsx`, `middleware.ts`, existing NestJS controllers (except the A1 fix in Phase 0), `render.yaml` (unless owner approves), database data.

---

## 6. Owner decisions required before Phase 2 starts

| ID | Decision | Default in this plan |
|---|---|---|
| Q1 | Authoritative fabric stock system | Show both, labelled |
| Q2 | Fix quantity defects R3, R4, R7 before go-live | Yes before go-live for stock and QC answers |
| Q4 | QC send-step transfer challans: "ordinary" or not | Label as "transfer challan" |
| Q5 | Fix A1 (Nest Final Check auth) or retire Nest service | Fix before any deploy of the AI module |
| Q6 | Meaning of "Design Number" and serial number | Pending; design history lists sheets separately |
| Q7 | Test files allowed in repository | No (current rule) |
| Q8 | Admin flag from database (A3 fix) | Yes, with migration |
| Q9 | Dispatch in scope | No |
| Q10 | Cutting and Stitching QC / Buttons as stages | Pending |
| Q11 | Model and budget | Owner |
| D-S1 | Shared secret option (S1 same secret / S2 assertion) | S1 |
| D-S2 | Gateway key | Yes |
| D-S3 | Read-only database role | Yes |
| Q-DB1…Q-DB7 | See `AI-DATABASE-DESIGN.md` §9 | As listed there |

---

## 7. Sequence (after approval)

| Step | Work | Output | Verification |
|---|---|---|---|
| 0 | Owner answers §6; owner runs read-only checks U1–U3 (Audit §10) | Decisions recorded | — |
| 0a | A1 fix: guard or remove unauthenticated Final Check Nest endpoints | Patch | `tsc`; manual call without token returns 401 |
| 0b | A3 fix: database admin flag (migration) and removal of username-based access in `session-user.ts` | Patch + SQL | Regression of every department login (owner check) |
| 0c | A4 fix: department checks on six production-data GET routes | Patch | Cross-department call returns 403 |
| 2a | SQL file, schema models, client regeneration | Files | Owner runs SQL; `pg_tables` check |
| 2b | NestJS module (Section 2.4), config, guards | Files | `tsc -p backend/tsconfig.build.json`; manual token tests (audit T26, T27) |
| 2c | Next proxy and UI (Section 2.5) | Files | `next build`; manual UI test |
| 2d | Shared package and shims (Section 4) | Files | `next build`; department smoke tests |
| 3 | Audit §9 test cases | Results log in `docs/ai-assistant/` | Owner sign-off |
| 4 | Feature switch on for admin; then per department | Config change | Owner per stage |

---

## 8. Rollback

- Feature switch `AI_ASSISTANT_ENABLED=false` disables routes at both layers.
- Remove the `AiAssistantModule` import and the launcher element; the MES pages are unaffected because the assistant has no shared state with them.
- Shared-package shims can be reverted to the original `.mjs` files (kept in git history).
- Tables can be dropped after owner review (no existing table references them).

---

## 9. Acceptance criteria for Phase 2

1. `tsc` and `next build` pass with zero new errors.
2. Every existing department page behaves as before (owner smoke test list).
3. Every audit test case in §9 of `PHASE-1-FINAL-AUDIT.md` passes, with results recorded.
4. No tool contains a write call (scan).
5. No secret value appears in any committed file or log line (scan).
6. The feature switch off returns 404 from the proxy and the NestJS module.
