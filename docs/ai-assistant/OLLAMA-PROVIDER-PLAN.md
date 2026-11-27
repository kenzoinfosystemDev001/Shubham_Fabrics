# AI Assistant — Provider, Hosting and Migration Plan (Ollama-first)

**Status:** Planning document. **No source code, dependency, environment file, database schema or production data has been changed.** Phase 2 has not started. Waiting for explicit approval.
**Supersedes:** the earlier hosting recommendation in this document (a company server as the only production topology). That recommendation is withdrawn; see §2.
**Companion documents:** `PHASE-1-FINAL-AUDIT.md`, `AI-ARCHITECTURE.md`, `AI-DATABASE-DESIGN.md`, `AI-SECURITY-PLAN.md`, `AI-IMPLEMENTATION-PLAN.md`.

Labels: **VERIFIED** (read in the repository or endpoint by me), **REPORTED** (from you, not re-checked), **ASSUMED** (inferred; must be confirmed), **RECOMMENDATION**, **DECISION** (confirmed by you).

---

## 1. Current status

| Item | Status | Evidence |
|---|---|---|
| AI module in NestJS | Not implemented. No AI code in `backend/src`, `frontend/src`, `worker/src`, `packages/*/src`, `scripts/`. | Source search. **VERIFIED** |
| OpenAI verification | Done with a scratch script outside the repository. Authentication and model lookup passed; a Responses call returned 429 `insufficient_quota`. | Earlier report. **VERIFIED** (then) |
| Environment variables | `OPENAI_API_KEY`, `OPENAI_MODEL` in `backend/.env` and `backend/.env.example` (both git-ignored; see §4.5). Names only checked. | **VERIFIED** (names) |
| Ollama API | `GET http://localhost:11434/api/tags` lists `qwen2.5:3b`. | **VERIFIED** (by me, read-only) |
| Ollama generate endpoint and version 0.40.18 | Passed on your PC. | **REPORTED** |
| Render backend environment | `render.yaml` defines `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `NODE_ENV`, `PORT`. **No AI variables yet.** | **VERIFIED** |
| Vercel frontend configuration | `frontend/vercel.json` defines one cron only. No function duration or AI settings. | **VERIFIED** |
| Phase 1 findings A1, A3, A4 | Still open when last checked: unguarded Final Check controller, username-based admin, session-only `defective-shelf` read. | **VERIFIED** (grep) |

---

## 2. Confirmed product decisions

| # | Decision | Consequence for this plan |
|---|---|---|
| D-1 | The AI Assistant is a **permanent core feature** of the MES. It is not experimental or scheduled for removal. | Design for production from the start: auditing, retention, security and migration are required, not optional. |
| D-2 | Ollama is the **primary provider**. | The provider interface must be built around Ollama's native API, with OpenAI as an optional second implementation. |
| D-3 | Model for development and evaluation: `qwen2.5:3b`. | Final model is chosen by evaluation (§9), not fixed. |
| D-4 | Frontend: **Vercel** now, **AWS** later. | Next.js remains the only browser-facing layer. |
| D-5 | Backend: **Render** now, **AWS** later. | NestJS orchestration runs on Render now and must be movable without code changes. |
| D-6 | Database: existing **Neon PostgreSQL**. | Conversations and audit data live in Neon, independent of where the model runs. |
| D-7 | Conversations are **persistent**. | Stored in Neon (§8). |
| D-8 | AI capabilities are **read-only**. | No write tools, no SQL (unchanged from Phase 1). |
| D-9 | Department users see their authorized department data; authorized Admins see permitted company-wide data. | Scope rules from Phase 1 apply unchanged. |
| D-10 | OpenAI may be added later as an **optional** provider, and must **not be required**. | Provider selection is configuration; the app starts and works with Ollama alone. |
| D-11 | **No automatic provider fallback.** | If Ollama is unavailable, the assistant reports unavailability. It never silently switches providers or sends data elsewhere. |
| D-12 | **No public exposure of the Ollama API.** | The inference endpoint must sit behind TLS and authentication, reachable only from the NestJS host. Detailed in §5. |
| D-13 | Do not start AWS deployment now. | AWS is designed for (§7) but not built. |

**Superseded earlier recommendation:** the earlier plan recommended a company server as the only production topology for NestJS and Ollama. That was based on the assumption that Render would be replaced. With the decisions above (Render stays until AWS), the company-server-only option is no longer the default. §5 gives the options.

---

## 3. Target architecture (provider-independent)

### 3.1 Layers

```
Browser
  │  (Next.js pages on Vercel; httpOnly session cookie)
  ▼
[1] Next.js proxy routes on Vercel      frontend/src/app/api/assistant/*
  │  HTTPS, Authorization: Bearer <session token> (forwarded server-side)
  ▼
[2] NestJS AI module on Render (→ AWS)  backend/src/modules/ai-assistant/
  │  ├─ session guard (verifies the token; re-reads the user)        [provider-independent]
  │  ├─ department scope service (database departmentCode; admin flag) [provider-independent]
  │  ├─ conversation service (Neon: ai_* tables)                      [provider-independent]
  │  ├─ tool registry + tool runner (read-only, zod, row caps)        [provider-independent]
  │  ├─ business calculations (shared rules package)                  [provider-independent]
  │  ├─ source references, usage and audit logging                    [provider-independent]
  │  └─ AiProvider interface  ──►  OllamaProvider | OpenAiProvider (optional)   [provider-specific]
  │
  ├──► Neon PostgreSQL (MES tables read-only; ai_* tables read-write)
  │
  └──► [3] Inference endpoint (Ollama)    HTTPS + gateway token, private or gated
```

**Key rule (DECISION-compatible):** tools execute **inside NestJS**, next to the database. The model host receives only prompts and tool results. It never connects to Neon and never receives a database credential. This keeps MES data access under the same controls whichever host runs the model.

### 3.2 What is provider-independent (must not depend on Ollama or OpenAI)

| Component | Path (planned) | Why independent |
|---|---|---|
| Session guard | `backend/src/modules/ai-assistant/guards/` | Identity is the same regardless of model |
| Department scope | `.../scope/` | Authorization must not vary by provider |
| Conversation service and `ai_*` tables | `.../conversations/`, Neon | Persistence must survive a provider or host change |
| Tool registry and runner | `.../tools/` | Read-only rule and row caps are a business control |
| Business calculations | shared rules package | Quantities must match the screens, not the model |
| Source references and audit | `.../logging/` | Traceability is a requirement |
| Orchestration loop | `.../orchestration/` (planned) | Calls the provider interface only |

### 3.3 What is provider-specific (isolated behind the interface)

| Component | Path (planned) | Notes |
|---|---|---|
| `AiProvider` interface | `.../providers/ai-provider.ts` | Neutral types for messages, tool specs, tool calls, usage |
| `OllamaProvider` | `.../providers/ollama.provider.ts` | Native `/api/chat`; allow-listed endpoints only |
| `OpenAiProvider` (optional, later) | `.../providers/openai.provider.ts` | Not written now; the interface does not change when added |
| Provider factory | `.../providers/provider.factory.ts` | Reads `AI_PROVIDER`; no other code branches on provider name |

### 3.4 Interface (RECOMMENDATION)

```
interface AiProvider {
  readonly name: 'ollama' | 'openai';
  health(signal: AbortSignal): Promise<ProviderHealth>;          // ok | unreachable | model_missing | auth_failed
  chat(input: {
    system: string;                       // server-owned system prompt
    messages: ProviderMessage[];          // trimmed history; roles USER | ASSISTANT | TOOL
    tools: ToolSpec[];                    // from the read-only registry only
    maxOutputTokens: number;
    signal: AbortSignal;                  // enforced timeout
  }): Promise<ProviderResult>;            // text | toolCalls[] | usage | finishReason
}
```

Tool arguments returned by any provider are validated with zod in the tool runner before anything runs. A provider's output is data, never an instruction to the application.

### 3.5 Switching providers

- Change `AI_PROVIDER` and the provider's own variables. No code in orchestration, tools, scope, persistence or logging changes.
- Acceptance test for replaceability (§10, O-20): run the same evaluation set against a second provider implementation (for example a scratch stub) and confirm identical authorization and audit results.

---

## 4. Environment configuration

### 4.1 Loading (VERIFIED)

- `backend/src/load-env.ts` loads `backend/.env` through dotenv, resolved from both `src/` and `dist/`.
- Variables already set in the host environment **override** the file. Render and AWS therefore set production values in the host environment, and the file is used only for local development.

### 4.2 Variable names

| Name | Purpose | Local dev | Render (now) | AWS (later) |
|---|---|---|---|---|
| `AI_ASSISTANT_ENABLED` | Feature switch | `true` | `true` once approved | `true` |
| `AI_PROVIDER` | `ollama` \| `openai` \| `disabled` | `ollama` | `ollama` | `ollama` |
| `OLLAMA_BASE_URL` | Inference endpoint base URL | `http://localhost:11434` | `https://<inference-host>` (gated, §5) | `http://<private-address>:11434` inside the VPC |
| `OLLAMA_MODEL` | Model name as listed by Ollama | `qwen2.5:3b` | Same as tested build | Chosen after evaluation |
| `OLLAMA_GATEWAY_TOKEN` | Bearer token checked by the inference gateway | Not set | Required (secret) | Not required inside the VPC; required if a gateway is used |
| `OLLAMA_REQUEST_TIMEOUT_MS` | Per-call timeout | `120000` | `120000` | Tuned on AWS hardware |
| `OLLAMA_NUM_CTX` | Context window | `4096` | `4096` | Tuned |
| `OLLAMA_MAX_OUTPUT_TOKENS` | Output cap | `512` | `512` | Tuned |
| `OPENAI_API_KEY` | Optional provider | Not required | Not set | Not set |
| `OPENAI_MODEL` | Optional provider | Not required | Not set | Not set |
| `AUTH_SECRET` | Verify Next session tokens (Phase 1 S1 option) | Same value as frontend | Same value as Vercel frontend | From AWS secrets store |
| `AI_GATEWAY_KEY` | Optional proxy → NestJS check | Optional | Set on Vercel and Render | From AWS secrets store |
| `AI_SERVICE_URL` (Vercel) | Where the Next proxy sends requests | `http://localhost:3001` | `https://<render-backend-host>` (Render URL, to confirm) | AWS load balancer URL |
| `AI_DAILY_COST_CAP_USD` | Cost cap; applies to paid providers only | `0` | `0` | `0` for Ollama |

**Rules:**

- Provider-specific variables are validated only for the selected provider.
- `AI_PROVIDER=disabled` starts the app without assistant routes.
- An unknown `AI_PROVIDER` fails at startup, not at the first request.
- No value is written to git. `.env.example` files are git-ignored (`.gitignore` line 47); names are documented here, values never.

### 4.3 Environment set per stage

**Development (your Windows PC)**

- Vercel: not used for AI development; run `next dev` locally with `AI_SERVICE_URL=http://localhost:3001`.
- NestJS: run locally with `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`.
- Ollama: default loopback bind (`127.0.0.1`).
- Database: Neon (the same database as production). Phase 2 development must therefore use only read-only checks against production data or an approved development branch. **Open question Q-H4 below.**

**Hosted pilot (Vercel + Render + inference host, §5)**

- Vercel: `AI_SERVICE_URL` (Render URL), `AI_GATEWAY_KEY`, `AUTH_SECRET`.
- Render: `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL` (gated inference host), `OLLAMA_GATEWAY_TOKEN`, `AUTH_SECRET`, `AI_GATEWAY_KEY`, existing `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
- Inference host: Ollama bound to loopback, behind the gateway (§5.3).

**AWS (later)**

- NestJS and Ollama in the same VPC; Ollama on a private address with a security group allowing only the NestJS security group on 11434.
- No gateway token needed inside the VPC if network isolation is enforced; keep the token as defence in depth (RECOMMENDATION).
- Secrets from AWS Secrets Manager or Parameter Store, not from files.

### 4.4 Startup validation (RECOMMENDATION)

At startup, the AI config loader checks:

1. `AI_PROVIDER` is known.
2. Required variables for that provider are set and non-empty.
3. `OLLAMA_BASE_URL` parses as a URL. If it is `http://` and `NODE_ENV=production`, startup **fails** unless the host is a private address (`127.0.0.1`, RFC1918, or a VPC address). This blocks accidental plain-text internet exposure.
4. `AUTH_SECRET` is at least 32 characters, matching `session-token.ts`.

The loader reports names and reasons only, never values.

### 4.5 Git and secrets (VERIFIED)

- `backend/.env` and `frontend/.env.local` are git-ignored (`.gitignore` line 23). Git tracks no files under them.
- `.env.example` files are ignored by `*.example` (`.gitignore` line 47). Team sharing of names needs a `.gitignore` exception (decision P-5).
- Any secret for Vercel or Render is entered in their dashboards, never in the repository.

---

## 5. Secure inference hosting (required for the deployed application)

### 5.1 Why this section is needed (VERIFIED)

- Render's backend runs in Render's cloud. It cannot reach `localhost:11434` on your PC. Your PC must **not** be exposed to the internet (DECISION D-12). Therefore the deployed application needs an **inference host** that Render can reach over an authenticated, encrypted connection.
- Vercel never calls Ollama directly. Vercel calls Render; only Render calls the inference host.

### 5.2 Options

| Option | Description | Security | Cost | Fit with decisions | Recommendation |
|---|---|---|---|---|---|
| **H-1: Cloud VM with gated Ollama** | A small Linux VM (any cloud provider, same region as Render where possible) runs Ollama on loopback, with Caddy (or Nginx) on 443 in front. Caddy enforces TLS and a bearer token, and allows only `POST /api/chat` and `GET /api/tags`. | TLS; token; allow-list; no management endpoints; host firewall allows 443 only | Modest VM cost; no GPU needed for 3B pilot (ASSUMED) | Works now and moves to AWS by changing the URL | **Recommended for the pilot** |
| **H-2: Cloud VM over a private tunnel** (Tailscale or equivalent) | Render joins the tailnet using a subnet router or a tunnel service | Strong, but Render free services cannot run tailscale agents natively (ASSUMED); needs a router host | Moderate | Adds a non-AWS dependency | Possible; needs verification |
| **H-3: Cloudflare Tunnel with Access service token** | A public hostname that only accepts requests with a service token | Good if configured; still a public hostname | Low | Adds a third-party dependency | Possible; needs approval |
| **H-4: Company server behind public gateway** | Office server exposed through the company firewall | Depends on company network controls; exposes the office network | Low | Exposes the factory network; conflicts with D-12 spirit | **Not recommended** |
| **H-5: Move NestJS to the same host as Ollama** | Run the backend (and possibly Next) on the inference host | Removes one hop but still needs a public endpoint for Vercel to reach the backend | Moderate | Conflicts with keeping Render now | Not for now |
| **H-6: OpenAI cloud** | Hosted model | Data leaves to a vendor; per-call charges; not Ollama | Per call | Violates D-2 and D-10 "not required"; you wish to avoid charges | Not for now |

**Decision needed (P-1):** choose H-1 (recommended) or H-2/H-3 for the pilot.

### 5.3 Recommended H-1 design

1. **Network:** VM accepts inbound TCP 443 only. Ollama listens on `127.0.0.1:11434` only. No inbound 11434.
2. **TLS:** Caddy obtains a certificate for a dedicated hostname (for example `ai.<company-domain>`). Plain HTTP is refused.
3. **Authentication:** Caddy requires `Authorization: Bearer <OLLAMA_GATEWAY_TOKEN>`; the token is a random value of at least 32 bytes, rotated on schedule, stored in Render's secret environment only.
4. **Route allow-list at Caddy:**

   | Path | Method | Allow |
   |---|---|---|
   | `/api/chat` | POST | Yes |
   | `/api/tags` | GET | Yes (health) |
   | `/api/pull`, `/api/push`, `/api/create`, `/api/copy`, `/api/delete` | any | **No** |
   | everything else | any | **No** (404) |

5. **Rate limit at Caddy:** a coarse per-minute limit as a second layer behind NestJS limits.
6. **Request size limit:** bounded body size (for example 256 KB) to refuse oversized prompts.
7. **Logging:** Caddy access logs record method, path, status and timing only, never the request body or the bearer token. Ollama's own logs are restricted and rotated; whether Ollama logs prompt text is **ASSUMED**, to be verified on the installed version.
8. **Host hardening:** dedicated non-root service user; automatic security updates; SSH by key only; Ollama pinned to a reviewed version.
9. **Model pull:** pull `qwen2.5:3b` once on the host, record its digest, and do not pull at startup.

### 5.4 Why this does not expose your PC

- Your Windows PC is used only for development. It is never a target of Render's requests. Render's deployed backend reaches the H-1 VM, not your PC.
- During development, your local NestJS talks to your local Ollama directly (`localhost`). The deployed application never depends on your PC.

### 5.5 Latency and platform limits (ASSUMED; verify)

| Limit | Impact | Mitigation |
|---|---|---|
| Vercel function duration (plan-dependent) | A long CPU inference could exceed the proxy's limit | Keep the Vercel proxy as a thin forwarder; measure p95; if needed, switch to an asynchronous job pattern (§5.6) |
| Render free plan cold start | First request after idle may be slow | Accept for pilot; upgrade plan later; health check warms service |
| Render request timeout (ASSUMED) | Long model calls may be cut | Keep output short; measure |
| CPU inference time for 3B | Seconds to tens of seconds per answer | Evaluate on H-1 hardware (O-17) |

### 5.6 Asynchronous option (decision P-13, if latency requires it)

If synchronous turns exceed platform limits: Render stores a job, returns immediately with a job ID; the browser polls the job status through Vercel. Adds a job table and polling. Not built unless measurements require it.

---

## 6. Development to hosted migration path

| Stage | Frontend | Backend | Inference | Database |
|---|---|---|---|---|
| 0. Development | `next dev` on PC | NestJS on PC | Ollama on PC (loopback) | Neon (read-only checks; see Q-H4) |
| 1. Hosted pilot | Vercel | Render | H-1 VM (gated) | Neon |
| 2. AWS | Vercel or AWS (decided later) | AWS (ECS or EC2) | Ollama in private subnet | Neon, or RDS if decided later |

**Stage 1 → 2 changes (planned, no code change):**

1. Set `OLLAMA_BASE_URL` to the private address; set `AI_SERVICE_URL` to the AWS backend endpoint; move secrets to AWS Secrets Manager.
2. Move the NestJS service and Ollama into the same VPC; restrict Ollama's security group to the backend's security group.
3. Keep Caddy only if a gateway is still wanted; otherwise remove it (inside the VPC the network boundary is primary).
4. Repoint DNS; run O-04 to O-19 again on AWS.

**What does not change between stages:** the AI application layer (orchestration, tools, scope, persistence, logging, provider interface). This is the central design goal of the plan.

**Frontend note:** the browser always talks to the Next.js proxy on the frontend host. If the frontend moves from Vercel to AWS, only `AI_SERVICE_URL` and the cookie domain settings change; the proxy code is unchanged.

---

## 7. AWS migration design (planned, not started)

| Concern | Planned approach |
|---|---|
| Backend hosting | Container or EC2 running the same NestJS build (`backend/dist/main.js`) |
| Inference | Ollama on EC2 (CPU for pilot; GPU instance class if evaluation requires); private subnet; no public IP |
| Network | Security groups: inference accepts 11434 from backend SG only; backend accepts HTTPS from the load balancer only |
| Secrets | AWS Secrets Manager; injected as environment variables at start |
| Model storage | Model files on an encrypted EBS volume; digest recorded |
| Logs | CloudWatch with a redaction filter; no prompt text (AI-SECURITY-PLAN §4.7) |
| Database | Neon remains (D-6); a later RDS move is a separate decision |
| Scaling | Inference is the bottleneck; one model instance per host; queue per §8 |
| Backups | Model files are reproducible from the registry; conversation data is in Neon backups |

No AWS resource is created in this plan.

---

## 8. Persistent conversations (independent of hosting)

- Conversation, message, source, usage and audit data is stored in the **existing Neon database** in `ai_*` tables, as specified in `AI-DATABASE-DESIGN.md`.
- The NestJS service writes these rows. Render, AWS or a later host only changes where NestJS runs; the data stays in Neon.
- If the inference host is down, users can still **list, open, rename and archive** their conversations, because those operations do not call the model. Only new questions are refused.
- Message text is stored in Neon, a cloud database. It is protected by Neon's encryption at rest (ASSUMED; confirm with the provider) and by the owner-only rules in Phase 1 §5.
- Tool results are not stored as message text; only source references (type, ID, label, unit, row count) are stored (AI-DATABASE-DESIGN §2.3).

---

## 9. Model choice and limitations (qwen2.5:3b)

Limitations below are **ASSUMED** until measured.

| Limitation | Mitigation |
|---|---|
| Weaker tool selection | Small tool list; zod validation; deterministic routing for fixed question types; wrong-tool rate measured (O-15) |
| Weak arithmetic and multi-step reasoning | Backend computes all totals; the model receives a single result set per tool and never adds or converts |
| Shorter reliable context | History trimmed; `num_ctx` set explicitly |
| Susceptible to prompt injection | Injection cannot change scope, tools, or writes; enforced outside the model |
| Output format drift | Parse, validate, one retry, then refusal |

**Evaluation gate (RECOMMENDATION):** before any department sees the assistant, run the evaluation set (O-15) on the H-1 hardware. Thresholds to be set by you (suggested: 0 wrong numbers; no more than 5% wrong tool selection). If the gate fails, change `OLLAMA_MODEL` to a larger model; no code change is required.

---

## 10. Testing plan

Project constraint: no test files in the repository (`.gitignore`; Phase 1 Q7). Tests run as scripts outside the repository, plus build gates, unless you approve a policy change.

| ID | Test | Pass condition |
|---|---|---|
| O-01 | Missing `OLLAMA_BASE_URL` with `AI_PROVIDER=ollama` | Startup fails, naming the variable only |
| O-02 | `AI_PROVIDER=openai` without key | Fails; Ollama provider not started |
| O-03 | Unknown `AI_PROVIDER` | Startup fails |
| O-04 | Production `http://` to a public host | Startup fails (§4.4 rule 3) |
| O-05 | Health: endpoint reachable, model present | `ok` |
| O-06 | Health: endpoint unreachable | `unreachable`; no stack |
| O-07 | Health: model missing (404) | `model_missing` |
| O-08 | Gateway without token | 401 from gateway; NestJS maps to fixed message |
| O-09 | Gateway with wrong token | 401; no token echoed |
| O-10 | Gateway: `/api/pull`, `/api/delete` | 404 or 403 |
| O-11 | Chat without tools | Text and usage recorded |
| O-12 | Chat with a tool call | Tool name and arguments parsed; zod runs before any tool |
| O-13 | Malformed tool arguments | Refused; one retry; then refusal; audit row |
| O-14 | Unknown tool name | Refused; no query |
| O-15 | Evaluation set (50 questions across departments; unit and partial-quantity cases) | Wrong-tool and wrong-number rates recorded |
| O-16 | Numeric check | Every number in an answer appears in the tool output |
| O-17 | Latency p50 and p95 on H-1 hardware | Recorded; compared with platform limits (§5.5) |
| O-18 | Timeout | Stopped at configured time; usage `TIMEOUT` |
| O-19 | Read-only scan | No write method in provider or tool code |
| O-20 | Provider replaceability | Same authorization and audit results with a second provider stub |
| O-21 | No fallback | Ollama down → unavailable message; no call to any other provider |
| O-22 | Secret scan | No gateway token, API key or DB URL in logs, responses or repository |
| O-23 | Conversation availability when inference is down | List, open, rename, archive still succeed |

The evaluation set must use records the owner approves, or read-only copies of production data. No mock production records are created.

---

## 11. Outstanding decisions

| ID | Decision | Recommendation |
|---|---|---|
| P-1 | Pilot inference host: H-1 (cloud VM with Caddy gateway), H-2 or H-3 | H-1 |
| P-2 | Hardware for the pilot host (RAM, CPU or GPU) | Start with CPU; measure (O-17) |
| P-3 | Initial model after evaluation | Keep `qwen2.5:3b` for pilot; decide after O-15 |
| P-4 | Render or AWS for NestJS during pilot | Render (current decision) |
| P-5 | `.gitignore` exception for `.env.example` | Approve |
| P-6 | Test policy (Phase 1 Q7) | Keep no test files in repo |
| P-7 | A1, A3, A4 fixes before Phase 2 | Required |
| P-8 | Admin database flag (Phase 1 Q8) | Required |
| P-9 | Shared secret option S1 (same `AUTH_SECRET`) | S1 |
| P-10 | Shared rules package move | Approve with regression plan |
| P-11 | Who operates the inference host and its update policy | Owner |
| P-12 | Accept unavailability when inference is down (D-11) | Yes |
| P-13 | Synchronous turns, or asynchronous job pattern | Synchronous until measured |
| Q-H1 | Vercel plan and function duration limit | Owner to confirm |
| Q-H2 | Render plan (cold starts, timeouts) | Owner to confirm |
| Q-H3 | Render's public hostname for the backend | Owner to confirm |
| Q-H4 | Development database: Neon production only, or an approved Neon development branch | Recommend an approved development branch; no writes against production |
| Q-H5 | Domain for the inference host (`ai.<company-domain>`) | Owner to provide |
| Q-H6 | Who holds the gateway token and rotation schedule | Owner |

---

## 12. Implementation sequence (after approval; nothing starts now)

| Step | Work | Gate |
|---|---|---|
| 0 | Decide P-1, P-4, Q-H1 to Q-H6; complete A1, A3, A4 and P-8, P-9 | Owner |
| 1 | Provision the pilot inference host (H-1) and verify TLS, gateway token, allow-list (O-08 to O-10) | Owner runs provisioning |
| 2 | Config loader with startup validation (§4.4); O-01 to O-04 | Owner approval |
| 3 | `AiProvider` interface, factory, `OllamaProvider` (`/api/chat`, timeouts); O-05 to O-07, O-11, O-18 | Owner approval |
| 4 | Tool registry and runner scaffolding; O-12 to O-14, O-19 | Owner approval |
| 5 | AI tables and conversation endpoints (Neon); O-23 | Owner runs migration |
| 6 | First read-only tools with backend-computed quantities; O-15 to O-17 on the pilot host | Owner reviews results |
| 7 | Vercel proxy routes and UI behind the feature switch; end-to-end test | Owner approval |
| 8 | Staged rollout: admin, one department, all | Owner per stage |
| 9 | AWS readiness: O-20 replaceability, O-21 no fallback, configuration-only switch rehearsal (not deployed) | Owner before any AWS work |

---

## 13. Change log (this revision)

| Section | Change |
|---|---|
| Whole document | Rewritten around the permanent-feature decision (§2) |
| §1 | Current status updated; Render and Vercel configuration verified |
| §2 | New: confirmed decisions D-1 to D-13; earlier company-server-only recommendation withdrawn |
| §3 | New: provider-independent architecture, layers, and interface |
| §4 | Environment names per stage (dev, Render/Vercel pilot, AWS); startup validation rules |
| §5 | New: secure inference hosting options H-1 to H-6, recommended H-1 design, platform limits |
| §6 | New: development → hosted → AWS migration path |
| §7 | New: AWS migration design (planned, not started) |
| §8 | New: persistence independent of hosting |
| §9 | Model limitations and evaluation gate |
| §10 | Test plan extended to O-23 (replaceability, no fallback, availability) |
| §11 | Decisions: added hosting and platform questions Q-H1 to Q-H6 |
| §12 | Sequence updated; nothing started |

No other file was changed in this revision.
