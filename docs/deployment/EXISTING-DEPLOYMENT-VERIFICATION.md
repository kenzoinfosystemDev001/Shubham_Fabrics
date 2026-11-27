# Existing Deployment Verification

**Scope:** read-only audit of the repository, to verify the existing production setup against what the code expects.
**Not done:** no source, environment, Render, Vercel or Neon setting was changed; no migration was run; no production record was read or changed; no dependency was installed; nothing was deployed. No secret value was displayed. Only variable **names** and database **host names** were read.
**Repository:** `Shubham_Fabrics` (branch `good`, HEAD `2860b9d`).

**Labels**

- **VERIFIED**: confirmed from repository files by reading them.
- **NEEDS DASHBOARD VERIFICATION**: depends on a live setting in Render, Vercel or Neon that the repository cannot show. Listed in §9.
- **ISSUE**: a problem found in the code or configuration.
- **RECOMMENDATION**: a proposed improvement; not urgent unless marked.

---

## 0. Summary

1. **The browser uses the Vercel frontend only.** Every page calls same-origin `/api` routes that run inside the Next.js app on Vercel, and those routes query Neon directly. **VERIFIED**. The NestJS service on Render is not called by any frontend code (`grep` for the Render hostname returned nothing). **VERIFIED**. Whether the Render service is still running and serving anything is **NEEDS DASHBOARD VERIFICATION**.
2. **Render's health check is misconfigured.** `render.yaml` sets `healthCheckPath: /health`, but the NestJS health route is `/api/health` (global prefix `api`). **ISSUE**, if the service is live.
3. **CORS on the NestJS service allows every origin with credentials.** `backend/src/main.ts` uses `origin: '*'` with `credentials: true`. `CORS_ORIGIN` is declared in `render.yaml` but **never read** by the code. **ISSUE**. Browsers don't call this service today, so the practical risk depends on whether it's live (see Summary 1).
4. **Unauthenticated write endpoints on the NestJS service** (Final Check): **ISSUE** (Phase 1 finding A1), critical if the service is live.
5. **Migrations run automatically during Vercel production builds.** A failure fails the build. Currently 40 of 41 SQL files are in the runner's list; the one not listed is superseded by a re-runnable file that is listed. **VERIFIED**. Whether the database has applied them is **NEEDS DASHBOARD VERIFICATION**.
6. **The Prisma schema is applied with `db push` and manual SQL, not `prisma migrate`.** No `prisma/migrations` folder exists. **VERIFIED**. **ISSUE**: there is no migration history to compare against production.
7. **The background worker is not deployed by any configuration in the repository.** **VERIFIED**. The deadline-alert cron is defined in `frontend/vercel.json`. **VERIFIED**.
8. **Image storage uses Cloudinary when configured, otherwise the database.** Nothing writes uploaded files to a server disk. **VERIFIED**.
9. **Ollama is not referenced in any deployment file.** Render and Vercel cannot reach `localhost` on your PC. **VERIFIED** (no config references it; the networking limitation is a fact about the platforms).
10. **Environment variables are split across three places** (Render, Vercel, `.env` files), with no list in the repository of what production needs. **RECOMMENDATION**.

---

## 1. Frontend production API URL configuration

| Finding | Label | Evidence |
|---|---|---|
| In the browser, all API calls use the relative path `/api`, so they go to the same Vercel origin. | VERIFIED | `frontend/src/lib/api.ts` `getBaseUrl` (returns `'/api'` when `window` exists) |
| Server-side base URL: `https://${VERCEL_URL}/api` when `VERCEL_URL` is set, otherwise `NEXT_PUBLIC_API_URL`, otherwise `http://localhost:3000/api`. Vercel sets `VERCEL_URL` automatically. | VERIFIED | `frontend/src/lib/api.ts` lines 2–6 |
| `NEXT_PUBLIC_API_URL` is referenced only in that fallback line. It is **not needed** in production. | VERIFIED | grep of `NEXT_PUBLIC_` in `frontend/src` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is used by the browser for image URLs. | VERIFIED | `frontend/src/lib/cloudinary.ts` |
| Vercel's `VERCEL_URL` points to the deployment URL, which for preview deployments is not the production domain. Server-side self-calls would then go to a preview URL. | RECOMMENDATION | Code path in `api.ts`; confirm that no server code path relies on self-calls (none was found in this audit) |
| Which Vercel project, root directory and production domain are used. No `.vercel` folder exists in the repository, and there is no Vercel project file other than `frontend/vercel.json` (one cron). | NEEDS DASHBOARD VERIFICATION | §9 |

---

## 2. Backend production environment configuration

### 2.1 Variables declared in `render.yaml` for the NestJS service

| Name | Set how | Label |
|---|---|---|
| `NODE_ENV` | `production` | VERIFIED |
| `PORT` | `3001` | VERIFIED (the code uses `process.env.PORT || 3001`; Render injects its own `PORT` in practice, so the value may be overridden) |
| `DATABASE_URL` | secret (`sync: false`) | VERIFIED declaration; value NEEDS DASHBOARD VERIFICATION |
| `JWT_SECRET` | secret (`sync: false`) | VERIFIED declaration; value NEEDS DASHBOARD VERIFICATION; must be at least 32 characters (`backend/src/modules/auth/jwt-secret.ts`) |
| `JWT_EXPIRES_IN` | `7d` | VERIFIED declaration; the code reads the secret from `requireJwtSecret()`, and the expiry is read from the module's configuration (not verified in this audit) |
| `CORS_ORIGIN` | secret (`sync: false`) | **ISSUE**: declared but never read by `backend/src` (grep). Its value has no effect |

**Names the NestJS code reads that `render.yaml` does not declare:** none found for the AI feature. The NestJS code reads `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`. **VERIFIED** (`grep process.env` across `backend/src`).

### 2.2 `.env` files

| File | Names present (values not read) | Label |
|---|---|---|
| `backend/.env` | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `OPENAI_API_KEY`, `OPENAI_MODEL` | VERIFIED. Git-ignored (`.gitignore` line 23) |
| `frontend/.env.local` | `DATABASE_URL`, `AUTH_SECRET` | VERIFIED. Git-ignored |
| `backend/.env.example`, `frontend/.env.example` | same names | VERIFIED. **Not in git**: ignored by `*.example` (`.gitignore` line 47) |

### 2.3 Build and start commands

| Item | Value | Label |
|---|---|---|
| Render build | `npm install && npm run build:render` | VERIFIED (`render.yaml`) |
| `build:render` | `npx prisma generate --schema=packages/database/prisma/schema.prisma && npm run build:ordered` | VERIFIED (root `package.json`) |
| Render start | `node backend/dist/main.js` | VERIFIED |
| Render plan and region | `free`, `singapore` | VERIFIED (declared). Actual plan NEEDS DASHBOARD VERIFICATION |
| Vercel build | `frontend/package.json` `prebuild` runs the workspace builds, then `scripts/apply-appearance-migrations.js --vercel-production`, then regenerates the client copy; `build` is `next build` | VERIFIED. **ISSUE**: a production build applies database migrations (see §6). Whether Vercel's root directory is set to `frontend` or the repository root is NEEDS DASHBOARD VERIFICATION |

---

## 3. Backend CORS configuration and allowed Vercel domains

| Finding | Label | Evidence |
|---|---|---|
| `app.enableCors({ origin: '*', methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', credentials: true })` | VERIFIED | `backend/src/main.ts` lines 22–26 |
| Browsers refuse credentialed requests when the origin is `*`, so the setting is inconsistent. It also allows any site to make requests, if cookies or tokens were sent. | ISSUE | Standard CORS behaviour (ASSUMED browser policy; the Nest service uses the bearer scheme, not cookies) |
| No Vercel domain is listed anywhere. Because the browser never calls this service (§0), no Vercel domain is needed today. | VERIFIED | Frontend code search |
| `CORS_ORIGIN` is declared but unused. | ISSUE | §2.1 |
| Recommended CORS policy when the service is used: an explicit allow-list containing the production Vercel domain, and any preview domain pattern you need, with `credentials` only where a cookie is actually sent. | RECOMMENDATION | Not applied (no change allowed in this audit) |

---

## 4. Authentication and session/token handling

### 4.1 Live application (Next.js on Vercel)

| Item | Value | Label |
|---|---|---|
| Token | HS256, signed with `AUTH_SECRET` (or `JWT_SECRET` as fallback), minimum 32 characters | VERIFIED (`frontend/src/lib/auth/session-token.ts`) |
| Lifetime | 12 hours default; overridable by `AUTH_SESSION_HOURS` | VERIFIED |
| Cookie | `subham_mes_token`, httpOnly, `sameSite=lax`, `secure` when the request is HTTPS (checks `x-forwarded-proto`, which Vercel sets) | VERIFIED (`require-user.ts` `setSessionCookies`, `isHttpsRequest`) |
| Per-request check | Token verified, then user re-read from the database; inactive users refused | VERIFIED (`require-user.ts` `getSessionUser`) |
| Logout | Clears cookies; does not revoke the token server-side. A copied token stays valid until it expires (12 h) | VERIFIED (existing audit S3, `auth/logout/route.ts`) |
| `AUTH_SECRET` value on Vercel | Must be set in Vercel's environment; the repository cannot show it | NEEDS DASHBOARD VERIFICATION |
| Admin and department rules | Derived partly from username strings and usernames are not unique | ISSUE (Phase 1 A3) |
| Cron route authentication | `CRON_SECRET` bearer token or an administrator session | VERIFIED (`frontend/src/app/api/cron/deadline-alerts/route.ts`). The value on Vercel NEEDS DASHBOARD VERIFICATION |

### 4.2 NestJS service (Render)

| Item | Value | Label |
|---|---|---|
| Tokens | `@nestjs/jwt` signed with `JWT_SECRET` | VERIFIED (`backend/src/modules/auth/auth.module.ts`) |
| Login | Accepts username or email only; cannot sign in the accounts the live app uses (no station or PIN resolution) | VERIFIED (`auth.service.ts`) |
| Guards | `JwtAuthGuard` is per-controller; the Final Check controller has no guard | ISSUE (A1) |
| Role guards | Depend on tables emptied by `20261102_remove_roles.sql` | VERIFIED |

**Two independent token systems exist** (`AUTH_SECRET` on Vercel, `JWT_SECRET` on Render). If they hold the same value, a token from one can be verified by the other. This is not a risk by itself; it is an inconsistency to document. **RECOMMENDATION**.

---

## 5. Neon database connection configuration

| Item | Value | Label |
|---|---|---|
| Backend `DATABASE_URL` host | a Neon pooled endpoint (`-pooler` in the host name), region `us-east-2`, AWS-hosted | VERIFIED (host name only) |
| Frontend `.env.local` `DATABASE_URL` host | the same pooled host as the backend | VERIFIED. **Both services use the same database** |
| Query parameters present | `sslmode`, `channel_binding` | VERIFIED (keys only) |
| `sslmode` value | Not read; `require` is expected for Neon (ASSUMED) | NEEDS DASHBOARD VERIFICATION |
| Client-side pool settings added by code | `connect_timeout=30`, `pool_timeout=30`, `connection_limit=10` per Prisma client, unless the URL sets them | VERIFIED (`packages/database/src/index.ts`) |
| Pooled host and `pgbouncer` | The code deliberately does not add `pgbouncer=true` for Neon's pooler (a documented measurement in the code comment) | VERIFIED |
| Connection budget | Vercel can run many serverless instances, each with a pool of up to 10 connections. Total connections can exceed Neon's pooler limit under load | ISSUE (RECOMMENDATION: check Neon's connection limit for the plan and the Vercel concurrency) |
| Neon branch used by production | NEEDS DASHBOARD VERIFICATION (the repository does not name one) | §9 |
| Development database | The local `.env` files point at the same Neon host as each other. Whether that host is the production database is NEEDS DASHBOARD VERIFICATION. If it is, local development writes to production | NEEDS DASHBOARD VERIFICATION (verified: same host in both local files) |

---

## 6. Prisma production migration status and pending migration files

### 6.1 Mechanism

| Item | Value | Label |
|---|---|---|
| Schema | `packages/database/prisma/schema.prisma` (81 models, 8 enums) | VERIFIED |
| Base schema applied with | `prisma db push` (script `db:push` / `push`) | VERIFIED |
| `prisma/migrations` folder | **Does not exist** | VERIFIED |
| Later changes | Manual SQL in `packages/database/prisma/manual-migrations/` (41 files), run by `scripts/apply-appearance-migrations.js` | VERIFIED |
| Runner behaviour | Records each file in `_manual_migrations`; re-applies a file only if its contents change; `--vercel-production` runs only when `VERCEL_ENV=production`; a failure fails the build | VERIFIED (script header and `--vercel-production` check) |
| Automatic application | On each Vercel production build (`frontend` `prebuild`) | VERIFIED |

### 6.2 Files and runner list

| Check | Result | Label |
|---|---|---|
| Files on disk | 41 | VERIFIED |
| Files listed in the runner | 40 | VERIFIED |
| On disk but not listed | `20261026_fabric_stock_import.sql`. Its header says it was generated by `prisma migrate diff`, needs approval for the shared Neon database, and was never in the runner list. Its re-runnable replacement `20261102_fabric_stock_import_rerunnable.sql` **is** listed. | VERIFIED |
| Listed but missing on disk | None | VERIFIED |
| Whether the original `20261026_fabric_stock_import.sql` was applied by hand | Unknown. The re-runnable file says it is a no-op where the original was applied | NEEDS DASHBOARD VERIFICATION |
| Which files are recorded as applied in `_manual_migrations` on Neon | Unknown; the repository cannot show database state | NEEDS DASHBOARD VERIFICATION (§9) |
| Whether the latest files have been applied | Unknown | NEEDS DASHBOARD VERIFICATION |

### 6.3 Migration risks

| Risk | Label |
|---|---|
| The production build applies schema changes before the new code goes live, and a failure stops the build. This is intentional in the script comments. | VERIFIED (design) |
| `20261102_remove_roles.sql` deletes every row in `Role`, `UserRole` and `RolePermission`. The NestJS role guards depend on these tables. Whether this has run on production is unknown. | VERIFIED (content); NEEDS DASHBOARD VERIFICATION (applied) |
| There is no migration history to verify the production schema against the Prisma schema. `db push` reconciles the database with the schema, and drift can go unnoticed. | ISSUE |
| `/api/health` (Next) reports whether a migration is pending (table and column counts only) using `checkDatabaseSchema`. This is the closest existing check. | VERIFIED (`frontend/src/app/api/health/route.ts`) |

### 6.4 Recommendations

- Keep the manual SQL idempotent (as the re-runnable files are).
- Record a schema snapshot or the output of `prisma migrate diff` for production against the repository schema before the next change. **RECOMMENDATION** (no migration is run in this audit).

---

## 7. Existing Render and Vercel deployment configuration

### 7.1 Render (`render.yaml`)

| Item | Value | Label |
|---|---|---|
| Services declared | One: `subham-fabrics-api` (type `web`) | VERIFIED |
| Other Render services | Not declared. Any others would be created manually | NEEDS DASHBOARD VERIFICATION |
| Auto deploy and branch | Not declared in the file | NEEDS DASHBOARD VERIFICATION |
| `healthCheckPath` | `/health` | ISSUE (route is `/api/health`) |
| Persistent disk | None declared | VERIFIED |
| Worker service | None declared | VERIFIED |

### 7.2 Vercel (`frontend/vercel.json`)

| Item | Value | Label |
|---|---|---|
| Cron | `/api/cron/deadline-alerts` at `5 18 * * *` (Vercel evaluates cron expressions in UTC) | VERIFIED |
| Function duration, regions, headers, rewrites | Not declared | VERIFIED |
| Project settings (root directory, build command, environment variables, domains) | Not in the repository | NEEDS DASHBOARD VERIFICATION |
| Build command used | `prebuild` and `next build` in `frontend/package.json`; Vercel must use the `frontend` workspace and the root install | NEEDS DASHBOARD VERIFICATION |

### 7.3 Repository deployment files

| Item | Label |
|---|---|
| `.github/` folder | Exists, **contains no workflow files** (VERIFIED). No CI runs tests or builds |
| `infrastructure/docker/` and `infrastructure/nginx/` | Exist. Not referenced by `render.yaml` or Vercel. Whether they are used is NEEDS DASHBOARD VERIFICATION; the README describes them as used (the README is out of date, see Phase 1 §1.4) |

---

## 8. Background worker deployment requirements

| Finding | Label |
|---|---|
| `worker/src/main.ts` is a 26-line loop: `setInterval` every 60 s that counts challans and programs and logs a heartbeat. It does not process a queue. | VERIFIED |
| It needs a long-running Node process, which Vercel functions cannot provide. | VERIFIED (platform fact; ASSUMED for Vercel's model) |
| It is not declared in `render.yaml`, and it is not referenced by Vercel. If it runs, it was started manually or as a separate Render service. | VERIFIED (absence); NEEDS DASHBOARD VERIFICATION |
| The deadline alerts, which look like background work, run through the Vercel cron route, not the worker. | VERIFIED |
| Worker dependencies: `@shubham/config`, `@shubham/database`, `@shubham/types`. It shares the Neon database and so adds connections to the budget in §5. | VERIFIED |
| Recommendation: do not deploy the worker until its purpose is defined. It currently does no processing. | RECOMMENDATION |

---

## 9. File upload and persistent storage

| Item | Finding | Label |
|---|---|---|
| Image storage | Stored on Cloudinary when `CLOUDINARY_*` credentials are configured (`imageUrl` + `storageKey`), otherwise as bytes in the database (`storageProvider = DATABASE`, `imageData Bytes`) | VERIFIED (`schema.prisma` around lines 638–666; `frontend/src/lib/cloudinary.ts`) |
| Cloudinary credential names | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, or `CLOUDINARY_URL` | VERIFIED (names read by code) |
| Cloudinary configured in production | NEEDS DASHBOARD VERIFICATION. If not configured, images are stored in Neon, which grows the database | NEEDS DASHBOARD VERIFICATION |
| Server disk writes | None found in `frontend/src` or `backend/src` or `worker/src` (the matches are client-side file downloads in components) | VERIFIED |
| Vercel filesystem | Ephemeral; no app code relies on it | VERIFIED |
| Render disk | None declared; Render's filesystem is also not persistent across deploys | VERIFIED (declaration) |
| Image and file size limits | Not verified in this audit | NEEDS DASHBOARD VERIFICATION |
| Recommendation | Confirm Cloudinary is configured in production; monitor database size because byte-stored images grow Neon storage | RECOMMENDATION |

---

## 10. Health-check and production logging configuration

### 10.1 Health checks

| Endpoint | Behaviour | Label |
|---|---|---|
| Next: `GET /api/health` | Public. Runs a count query and a schema check. Returns `status: ok` or `degraded`. Returns only the number of missing tables and columns, not their names | VERIFIED (`frontend/src/app/api/health/route.ts`; the middleware allows it publicly) |
| NestJS: `GET /api/health` | Runs `SELECT 1`; returns status, uptime and latency. Public | VERIFIED (`backend/src/modules/health/health.controller.ts`, global prefix `api`) |
| NestJS root `/` | Excluded from the prefix; no root route defined | VERIFIED (`main.ts` `setGlobalPrefix('api', { exclude: ['/'] })`) |
| Render health check path | `/health` (no `api`); returns 404 | **ISSUE** |
| Render's check uses the path to decide whether to route traffic | Behaviour on failure NEEDS DASHBOARD VERIFICATION | NEEDS DASHBOARD VERIFICATION |

**Recommended fix (not applied):** set `healthCheckPath` to `/api/health`. This needs your approval because it changes `render.yaml`.

### 10.2 Logging

| Item | Finding | Label |
|---|---|---|
| Logging method | `console.log`, `console.error`, `console.warn` in 90 source files across frontend, backend and worker; no structured logger | VERIFIED |
| NestJS logger | Used at bootstrap only (`Logger` in `main.ts`) | VERIFIED |
| Secret exposure risk | Some handlers log error objects (for example the login handler logs the error). Whether any error carries secrets was not exhaustively checked | ISSUE (RECOMMENDATION: review error logging before adding AI) |
| Vercel and Render log retention and access | NEEDS DASHBOARD VERIFICATION | NEEDS DASHBOARD VERIFICATION |
| Log level or drain configuration | None in the repository | VERIFIED |

---

## 11. Current AI provider configuration and Ollama connectivity limitations

| Item | Finding | Label |
|---|---|---|
| AI code in the repository | None | VERIFIED |
| AI variables in `render.yaml` | None | VERIFIED |
| AI variables in `frontend/vercel.json` | None | VERIFIED |
| `OPENAI_API_KEY` and `OPENAI_MODEL` | In `backend/.env` only (local). Not declared for Render | VERIFIED (names) |
| Ollama on your PC | Reachable at `http://localhost:11434` from your PC. `qwen2.5:3b` is listed (verified earlier) | VERIFIED |
| Render reaching your PC | **Not possible**: Render's servers cannot reach `localhost` or a private address on your PC | VERIFIED (platform networking) |
| Vercel reaching your PC | **Not possible** for the same reason | VERIFIED (platform networking) |
| Exposing your PC publicly | Not recommended and not part of the plan (per your decision) | VERIFIED (decision) |
| Hosted Ollama | None exists yet | VERIFIED |
| Gateway, TLS or token for an inference host | None exists | VERIFIED |

**Implication:** the deployed application cannot use Ollama until an inference host exists (plan H-1 in `docs/ai-assistant/OLLAMA-PROVIDER-PLAN.md`). Nothing in the current deployment depends on Ollama, so the live application is unaffected.

---

## 12. Live-site concerns from the code (summary)

| Concern | Label | Where |
|---|---|---|
| Phase 1 A1: unauthenticated Final Check writes on the NestJS service | ISSUE (critical if live) | `backend/src/modules/finalcheck/finalcheck.controller.ts` |
| Phase 1 A3: admin and department by username | ISSUE | `frontend/src/lib/auth/session-user.ts` |
| Phase 1 A4: production-data reads that need only a session | ISSUE | `frontend/src/app/api/defective-shelf/route.ts` and five others |
| Phase 1 A5: role guards read emptied tables (NestJS) | ISSUE if NestJS is live | `backend/src/common/guards/roles.guard.ts` |
| Health check path mismatch | ISSUE | `render.yaml` |
| CORS `*` with credentials | ISSUE | `backend/src/main.ts` |
| Unused `CORS_ORIGIN` | ISSUE | `render.yaml` |
| Local environment files share one Neon host; whether it is production is unconfirmed | NEEDS DASHBOARD VERIFICATION (possible ISSUE) | `backend/.env`, `frontend/.env.local` |
| Migrations applied during production builds | VERIFIED behaviour; RECOMMENDATION to add a dry-run listing before each deploy | `frontend/package.json` `prebuild` |

---

## 13. Checklist for manual verification (Render, Vercel, Neon)

Do these yourself in each dashboard. Do not paste secret values into chat or into this file.

### 13.1 Render

- [ ] List all services in the Render workspace. Confirm whether `subham-fabrics-api` is live, and whether any other service (worker, cron) exists that `render.yaml` does not declare.
- [ ] Open `subham-fabrics-api` → Settings. Confirm: plan (free or paid), region, root directory, build command (`npm install && npm run build:render`), start command (`node backend/dist/main.js`), auto-deploy branch.
- [ ] Settings → Health check path. If it is `/health`, decide whether to change it to `/api/health` (requires your approval).
- [ ] Environment: confirm the **names** present match §2.1. Confirm `DATABASE_URL` points at the production Neon host (host name only). Confirm `JWT_SECRET` is at least 32 characters. Confirm whether `CORS_ORIGIN` is set (it has no effect in the code).
- [ ] Logs: check the last deploy log for the message "Shubham Fabrics MES Backend running" and for any errors.
- [ ] Traffic: check metrics for real requests. If there are none, the service is unused by the browser (§0).
- [ ] Confirm the service's public URL and whether `/api/health` responds (read-only request).
- [ ] Confirm that no AI variables are set (expected).

### 13.2 Vercel

- [ ] Project settings → Root directory: `frontend` or the repository root? Build command and install command must match the workspace layout.
- [ ] Environment variables (Production): confirm names present: `DATABASE_URL`, `AUTH_SECRET` (at least 32 characters), `CRON_SECRET`, and `CLOUDINARY_*` if used. Confirm `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` if uploads use it. Confirm there is no leftover `VERCEL_ENV` override.
- [ ] Confirm `AUTH_SECRET` (Vercel) and `JWT_SECRET` (Render) are different or intentionally equal (§4.2; Phase 1 S1 decision).
- [ ] Deployments: check the latest production deployment's build log. Confirm the migration runner printed "applied" or "already applied" for each file, and that no step failed.
- [ ] Domains: confirm the production domain and whether preview deployments are public.
- [ ] Cron: confirm the deadline-alert cron appears and last ran successfully.
- [ ] Function logs: check for database connection errors (pool exhaustion or timeouts; §5).
- [ ] Open `/api/health` on the production domain (read-only). Confirm `status: ok` and that `schema.missing` is 0.
- [ ] Confirm the Vercel project is connected to the correct repository and branch.

### 13.3 Neon

- [ ] Project → Branches: identify the branch used by production. Confirm whether a separate development branch exists.
- [ ] Connection details: confirm the pooled endpoint host (name only) and that `sslmode=require` is the setting in use.
- [ ] Connection limit and compute size for the plan; compare with the Vercel concurrency and the pool size of 10 per instance (§5).
- [ ] Storage: check total database size and growth. Byte-stored images (§9) contribute to this.
- [ ] SQL editor, read-only: `SELECT * FROM "_manual_migrations" ORDER BY 1;`. Confirm every file in §6.2 is recorded. **Read-only; do not run any DDL.**
- [ ] Read-only check: `SELECT COUNT(*) FROM "Role";`. Zero means the roles migration has run (Phase 1 U2).
- [ ] Read-only check: `SELECT username, COUNT(*) FROM "User" GROUP BY username HAVING COUNT(*) > 1;` (Phase 1 U3). Share only the count, not usernames.
- [ ] Backups and point-in-time recovery settings for the production branch.
- [ ] Who has access to the Neon project, and whether any shared credentials exist.

### 13.4 Local environment (your PC)

- [ ] Confirm `backend/.env` and `frontend/.env.local` point at the Neon branch you intend. If they point at production, decide whether local development should use a separate branch (Phase 1 / Ollama plan Q-H4).
- [ ] Confirm `.env` files are not committed: `git check-ignore -v backend/.env frontend/.env.local` should show each is ignored.

---

## 14. Decisions requested

| ID | Decision | Recommendation |
|---|---|---|
| E-1 | Is the Render NestJS service in use? If not, stop it or retire it after A1 is addressed | Confirm usage first (§13.1) |
| E-2 | Change Render's `healthCheckPath` to `/api/health` | Yes, with approval |
| E-3 | Remove or correct the `CORS_ORIGIN` declaration and the `*` CORS setting | Yes, with approval |
| E-4 | Separate development database branch for local work | Yes |
| E-5 | Add `!.env.example` exceptions to `.gitignore` | Your choice (Ollama plan P-5) |
| E-6 | Whether the worker is needed, and where it would run | Define its purpose first |
| E-7 | Add a dry-run listing of pending migrations before each production deploy | Yes |
| E-8 | Add a CI workflow that runs the typecheck and builds | Your choice; no tests exist |

No change is made in this audit. Each decision needs your approval before any action.

---

## 15. Limitations

- Live state of Render, Vercel and Neon could not be inspected from the repository. Those items are marked NEEDS DASHBOARD VERIFICATION.
- The migration runner's behaviour was read from source, not executed.
- Build and runtime behaviour were not tested. No build was run.
- Environment values were not read. Only names and host names were used.
