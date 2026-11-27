# AI Assistant — Database Design

**Status:** Design only. **No table has been created.** No migration file exists yet.
**Database:** the existing Neon PostgreSQL database. No separate database.

Conventions verified in the existing schema (`packages/database/prisma/schema.prisma`) and manual SQL (`packages/database/prisma/manual-migrations/`):

- Prisma models are PascalCase (`User`, `Challan`, `RolePermission`). Manual SQL quotes those names (`"RolePermission"`, `"UserRole"` in `20261102_remove_roles.sql`). The AI tables follow this, for example `"AiConversation"`. The user asked for `ai_*` names in the audit brief; **Q-DB1** below asks which convention to use. The default proposed here is the existing convention.
- Primary keys: `String @id @default(uuid())` (text UUID).
- Timestamps: `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` where edited.
- Foreign keys: relation fields with `onDelete` explicitly set. The existing schema uses `Cascade` for child rows (e.g. `ChallanItem`), `SetNull` for optional actors (e.g. `DepartmentHoldEvent.actor`).
- Money and quantity: `Float` in this codebase. The AI tables store token counts as `Int` and cost as `Float` (estimated), which is adequate for usage monitoring; they hold no production quantities.
- Users are not hard-deleted by the app; existing history is reattributed to a shared "Deleted User" (existing audit S7). The AI tables follow the same rule.

---

## 1. Entity overview

```
User (existing)
 ├── AiConversation (owner)            1 ── * AiMessage
 │                                           ├── AiMessageSource   (records used by an answer)
 │                                           └── AiFeedback        (rating by owner)
 ├── AiUsageLog     (tokens, cost)           per call
 └── AiAuditLog     (who asked, tool calls, denials)
```

---

## 2. Tables

### 2.1 `AiConversation`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `String` (uuid) | no | `uuid()` | PK |
| `userId` | `String` | no | — | FK → `User.id`; owner |
| `title` | `String` | no | `'New conversation'` | Renamable; max 120 chars, enforced in app |
| `departmentKeySnapshot` | `String?` | yes | — | Department key when created. Informational only; **never used for access** |
| `status` | `String` | no | `'ACTIVE'` | `ACTIVE` \| `ARCHIVED` (text, validated in code; matches the project's string-status convention) |
| `messageCount` | `Int` | no | `0` | Maintained by app; used for listing |
| `lastMessageAt` | `DateTime?` | yes | — | For ordering |
| `archivedAt` | `DateTime?` | yes | — | Set on archive |
| `deletedAt` | `DateTime?` | yes | — | Soft delete by owner |
| `createdAt` | `DateTime` | no | `now()` | |
| `updatedAt` | `DateTime` | no | `@updatedAt` | |

- **Primary key:** `id`.
- **Foreign keys:** `userId` → `User.id`, `onDelete: Restrict`. A user with conversations cannot be hard-deleted until they are reattributed; this matches the "deactivate, don't delete" practice. (Alternative: `SetNull` plus the Deleted-User rule. Q-DB2.)
- **Indexes:** `(userId, status, lastMessageAt DESC)` for the list view; `(userId, updatedAt)`.
- **Ownership:** every read and write filters `userId = scope.userId`. No admin override.
- **Retention:** owner delete sets `deletedAt`; a scheduled purge (Section 5) hard-deletes after the retention window.

### 2.2 `AiMessage`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `String` (uuid) | no | `uuid()` | PK |
| `conversationId` | `String` | no | — | FK → `AiConversation.id`, `onDelete: Cascade` |
| `role` | `String` | no | — | `USER` \| `ASSISTANT` \| `TOOL` (validated in code) |
| `content` | `String` (`@db.Text`) | no | — | Text as shown to the user; capped at 8,000 chars (app) |
| `toolName` | `String?` | yes | — | Set when `role = TOOL` |
| `toolArgsHash` | `String?` | yes | — | SHA-256 of normalized tool arguments. **Raw arguments are not stored** |
| `model` | `String?` | yes | — | Model name used for ASSISTANT rows |
| `status` | `String` | no | `'OK'` | `OK` \| `ERROR` \| `REFUSED` |
| `errorCode` | `String?` | yes | — | Fixed code, never a stack trace |
| `createdAt` | `DateTime` | no | `now()` | |

- **Foreign key:** `conversationId` → `AiConversation.id`, `onDelete: Cascade`.
- **Indexes:** `(conversationId, createdAt)` for ordered history; `(role, createdAt)` for monitoring.
- **Content handling:** user text is stored as typed (after length cap and control-character removal). Model text is stored as returned. Tool results are **not** stored in `content`; only in `AiMessageSource` as identifiers (Section 2.3).
- **Ownership:** reached only through the conversation, after the owner check.

### 2.3 `AiMessageSource`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `String` (uuid) | no | `uuid()` | PK |
| `messageId` | `String` | no | — | FK → `AiMessage.id`, `onDelete: Cascade` |
| `toolName` | `String` | no | — | One of the twelve registry names |
| `entityType` | `String` | no | — | e.g. `Challan`, `Program`, `DepartmentWorkItem`, `DepartmentHold`, `PackingAllocation` |
| `entityId` | `String` | no | — | Record ID (uuid) or business number, as the tool returned it |
| `entityLabel` | `String?` | yes | — | Business number shown to the user (e.g. `CH-DYE-2026-000123`). Short text only |
| `departmentKey` | `String?` | yes | — | Department the record was read under |
| `unit` | `String?` | yes | — | `MTR` \| `PCS` where a quantity was cited |
| `rowCount` | `Int` | no | `1` | Rows the tool returned for this record group |
| `createdAt` | `DateTime` | no | `now()` | |

- **Foreign key:** `messageId` → `AiMessage.id`, `onDelete: Cascade`.
- **Indexes:** `(messageId)`; `(entityType, entityId)` for "which answers cited this record" (admin audit, only through the AI audit route, with the owner rule still applied to content).
- **Purpose:** traceability from each answer to the records it used (requirement: "every response must be based on actual MES information").

### 2.4 `AiUsageLog`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `String` (uuid) | no | `uuid()` | PK |
| `userId` | `String` | no | — | FK → `User.id`, `onDelete: SetNull` (kept for cost history) |
| `conversationId` | `String?` | yes | — | FK → `AiConversation.id`, `onDelete: SetNull` |
| `messageId` | `String?` | yes | — | Message that triggered the call; no FK (keeps cost rows after message purge) |
| `model` | `String` | no | — | |
| `inputTokens` | `Int` | no | `0` | |
| `outputTokens` | `Int` | no | `0` | |
| `estimatedCostUsd` | `Float` | no | `0` | Computed from a price table in config; estimate only |
| `latencyMs` | `Int` | no | `0` | |
| `toolCalls` | `Int` | no | `0` | |
| `status` | `String` | no | — | `OK` \| `ERROR` \| `TIMEOUT` \| `CAPPED` \| `RATE_LIMITED` |
| `createdAt` | `DateTime` | no | `now()` | |

- **Indexes:** `(userId, createdAt)` for per-user rate and cap checks; `(createdAt)` for daily totals; `(status, createdAt)` for failure monitoring.
- **Retention:** 365 days (proposal, Q-DB3).

### 2.5 `AiAuditLog`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `String` (uuid) | no | `uuid()` | PK |
| `userId` | `String?` | yes | — | FK → `User.id`, `onDelete: SetNull`; `null` once the user record is reattributed |
| `action` | `String` | no | — | `CONVERSATION_CREATE` \| `CONVERSATION_READ` \| `CONVERSATION_RENAME` \| `CONVERSATION_ARCHIVE` \| `CONVERSATION_DELETE` \| `MESSAGE_SENT` \| `TOOL_CALL` \| `DENIED` \| `FEEDBACK` |
| `conversationId` | `String?` | yes | — | No FK (audit must survive conversation purge) |
| `toolName` | `String?` | yes | — | |
| `argsHash` | `String?` | yes | — | SHA-256 of normalized arguments |
| `resultCount` | `Int?` | yes | — | |
| `denialReason` | `String?` | yes | — | Fixed codes: `NOT_AUTHENTICATED`, `INACTIVE`, `NO_DEPARTMENT`, `OUT_OF_SCOPE`, `NOT_OWNER`, `RATE_LIMITED`, `CAP_REACHED`, `FEATURE_OFF` |
| `ipAddress` | `String?` | yes | — | Only if available from the proxy's `x-forwarded-for`; optional, owner decision (Q-DB4) |
| `createdAt` | `DateTime` | no | `now()` | |

- **Indexes:** `(userId, createdAt)`; `(action, createdAt)`; `(denialReason, createdAt)`.
- **Must not contain:** message text, tool results, tokens, PINs, cookies, the OpenAI key.
- **Retention:** 365 days (proposal). Not deleted when a conversation is purged.

### 2.6 `AiFeedback`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `String` (uuid) | no | `uuid()` | PK |
| `messageId` | `String` | no | — | FK → `AiMessage.id`, `onDelete: Cascade` |
| `userId` | `String` | no | — | FK → `User.id`, `onDelete: SetNull`. Must equal the message's conversation owner |
| `rating` | `String` | no | — | `UP` \| `DOWN` |
| `comment` | `String?` | yes | — | Max 500 chars, app-validated |
| `createdAt` | `DateTime` | no | `now()` | |

- **Unique:** `(messageId, userId)` — one rating per owner per message (update instead of insert).
- **Indexes:** `(messageId)`; `(userId, createdAt)`.
- **Ownership:** the API verifies that the message belongs to a conversation owned by the caller before writing.

---

## 3. Prisma model sketch (for Phase 2; not applied)

```prisma
model AiConversation {
  id                    String    @id @default(uuid())
  userId                String
  user                  User      @relation("AiConversationOwner", fields: [userId], references: [id], onDelete: Restrict)
  title                 String    @default("New conversation")
  departmentKeySnapshot String?
  status                String    @default("ACTIVE")
  messageCount          Int       @default(0)
  lastMessageAt         DateTime?
  archivedAt            DateTime?
  deletedAt             DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  messages              AiMessage[]
  usageLogs             AiUsageLog[]

  @@index([userId, status, lastMessageAt])
  @@index([userId, updatedAt])
}

model AiMessage {
  id             String   @id @default(uuid())
  conversationId String
  conversation   AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String
  content        String   @db.Text
  toolName       String?
  toolArgsHash   String?
  model          String?
  status         String   @default("OK")
  errorCode      String?
  createdAt      DateTime @default(now())
  sources        AiMessageSource[]
  feedback       AiFeedback[]

  @@index([conversationId, createdAt])
  @@index([role, createdAt])
}

model AiMessageSource {
  id             String   @id @default(uuid())
  messageId      String
  message        AiMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  toolName       String
  entityType     String
  entityId       String
  entityLabel    String?
  departmentKey  String?
  unit           String?
  rowCount       Int      @default(1)
  createdAt      DateTime @default(now())

  @@index([messageId])
  @@index([entityType, entityId])
}

model AiUsageLog {
  id               String   @id @default(uuid())
  userId           String?
  user             User?    @relation("AiUsageOwner", fields: [userId], references: [id], onDelete: SetNull)
  conversationId   String?
  conversation     AiConversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  messageId        String?
  model            String
  inputTokens      Int      @default(0)
  outputTokens     Int      @default(0)
  estimatedCostUsd Float    @default(0)
  latencyMs        Int      @default(0)
  toolCalls        Int      @default(0)
  status           String
  createdAt        DateTime @default(now())

  @@index([userId, createdAt])
  @@index([createdAt])
  @@index([status, createdAt])
}

model AiAuditLog {
  id             String   @id @default(uuid())
  userId         String?
  user           User?    @relation("AiAuditOwner", fields: [userId], references: [id], onDelete: SetNull)
  action         String
  conversationId String?
  toolName       String?
  argsHash       String?
  resultCount    Int?
  denialReason   String?
  ipAddress      String?
  createdAt      DateTime @default(now())

  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@index([denialReason, createdAt])
}

model AiFeedback {
  id        String   @id @default(uuid())
  messageId String
  message   AiMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId    String?
  user      User?    @relation("AiFeedbackOwner", fields: [userId], references: [id], onDelete: SetNull)
  rating    String
  comment   String?
  createdAt DateTime @default(now())

  @@unique([messageId, userId])
  @@index([messageId])
  @@index([userId, createdAt])
}
```

The `User` model needs back-relation fields added (`aiConversations AiConversation[] @relation("AiConversationOwner")`, and the same for `AiUsageLog`, `AiAuditLog`, `AiFeedback`). These are additive and do not change any existing column.

**Note:** `AiFeedback.userId` is nullable because of `SetNull`; the unique constraint still applies to non-null users. Owner check is done in the API.

---

## 4. Migration strategy

Project practice (verified): the base schema was applied with `prisma db push`; later changes are idempotent manual SQL in `packages/database/prisma/manual-migrations/`, run by `scripts/apply-appearance-migrations.js`, which records each file in `_manual_migrations` and runs automatically only in a Vercel production build. Owner runs migrations (project memory).

Plan:

1. **Draft SQL** `packages/database/prisma/manual-migrations/<YYYYMMDD>_ai_assistant.sql` with `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and foreign keys added inside `DO $$ … $$` blocks guarded by `pg_constraint` checks so re-runs are safe. Table names quoted to match Prisma (`"AiConversation"`, etc.).
2. **Register** the file in `scripts/apply-appearance-migrations.js` (`MIGRATIONS` list).
3. **Prisma models** added to `schema.prisma` in the same change, so `prisma generate` produces the client. `db push` must **not** be used against production for this change (it would also try to reconcile unrelated drift; the owner decides).
4. **Owner runs** the SQL on Neon, after reviewing it. Verification query (read-only): `SELECT tablename FROM pg_tables WHERE tablename LIKE 'Ai%';` expecting six rows.
5. **Regenerate the Prisma client** and copy changed generated files to the existing copies (project memory: "Prisma client copies"), so NestJS and Next both see the models.
6. **Rollback:** the tables are new and unreferenced by existing code. Rollback is `DROP TABLE` of the six tables in reverse dependency order. Dropping is owner-run and only after a feature-switch off.
7. **No data migration** is needed: the tables start empty.

Migration-level risks:

- The shared database serves the live app; `CREATE TABLE` is additive and does not lock existing tables for long.
- `User` back-relations add no columns. No existing row changes.
- Do not run `prisma migrate` (no migration history exists; Section 3.1 of the earlier report).

---

## 5. Retention and purge

| Data | Default | Rule | Mechanism (Phase 2) |
|---|---|---|---|
| Conversations and messages (ACTIVE) | Kept until owner deletes or 180 days idle (Q-DB3) | Owner can delete any time | Owner endpoint sets `deletedAt` |
| Soft-deleted conversations | Purged 30 days after `deletedAt` | Hard delete cascades to messages, sources, feedback | Scheduled job (see Section 6) |
| Archived conversations | Kept until owner deletes | Not auto-purged | — |
| `AiMessageSource` | Follows its message | Cascade | — |
| `AiUsageLog` | 365 days | Purge older rows | Scheduled job |
| `AiAuditLog` | 365 days | Purge older rows; never on conversation purge | Scheduled job |
| `AiFeedback` | Follows message | Cascade | — |

**Note on the scheduled job:** the existing app has one cron route (`frontend/vercel.json`: `/api/cron/deadline-alerts`). Phase 2 adds the purge either as a NestJS `@Cron` task (requires `@nestjs/schedule`, a new dependency) or a Next.js cron route (`vercel.json` change). Owner decision Q-DB5. The Render deployment has no scheduler defined (`render.yaml`), so a NestJS-side job would also need a Render cron job or an in-process timer. **BLOCKED** until Q-DB5.

---

## 6. Retention job (RECOMMENDATION)

Idempotent batch, runs daily:

```
DELETE conversations where deletedAt < now() - 30 days      (cascades)
DELETE AiUsageLog where createdAt < now() - 365 days
DELETE AiAuditLog where createdAt < now() - 365 days
```

Each batch is limited to 1,000 rows per run to avoid long locks on the shared database.

---

## 7. Indexes summary

| Table | Index | Purpose |
|---|---|---|
| AiConversation | (userId, status, lastMessageAt) | List my conversations |
| AiConversation | (userId, updatedAt) | Recently updated |
| AiMessage | (conversationId, createdAt) | Open a conversation |
| AiMessage | (role, createdAt) | Monitoring |
| AiMessageSource | (messageId) | Sources of an answer |
| AiMessageSource | (entityType, entityId) | Traceability |
| AiUsageLog | (userId, createdAt) | Rate and cap per user |
| AiUsageLog | (createdAt) | Daily totals |
| AiUsageLog | (status, createdAt) | Failure monitoring |
| AiAuditLog | (userId, createdAt) | My activity |
| AiAuditLog | (action, createdAt) | Monitoring |
| AiAuditLog | (denialReason, createdAt) | Denials |
| AiFeedback | (messageId, userId) unique | One rating per owner |

---

## 8. Ownership rules (summary)

| Operation | Rule |
|---|---|
| List conversations | `userId = caller`, `deletedAt IS NULL` |
| Open conversation | `id = :id AND userId = caller AND deletedAt IS NULL`; else 404 |
| Create conversation | `userId = caller` (never from body) |
| Rename / archive / delete | Owner only; 404 otherwise |
| Send message | Owner, active status, and fresh authentication and scope (Section 4.6 of AI-ARCHITECTURE) |
| Feedback | Message belongs to caller's conversation; one per owner |
| Admin | No access to other users' conversations or messages. Admin's audit view shows counts and denial reasons, not content (Q-DB6) |
| Usage and audit rows | Written by the server only; the API has no read endpoint for other users' rows |

---

## 9. Decisions and open items (database)

| ID | Question | Recommendation |
|---|---|---|
| Q-DB1 | Table names: `"AiConversation"` (Prisma/existing convention) or `ai_conversations` (name in the audit brief)? | Existing convention: PascalCase model names, with `@@map("ai_conversations")` available if the brief's names are required. Owner chooses. |
| Q-DB2 | `AiConversation.userId` on delete: `Restrict` or `SetNull`? | `Restrict`, matching "deactivate, don't delete" |
| Q-DB3 | Retention periods | 180 days idle conversations; 365 days logs |
| Q-DB4 | Store IP address in audit rows? | Only if the owner accepts the personal-data impact; default **no** |
| Q-DB5 | Where does the scheduled purge run (Nest scheduler, Render cron, or Next cron)? | Owner decides; see Section 5 |
| Q-DB6 | Should admins see conversation content for support purposes? | No, per requirement; support uses counts and audit rows only |
| Q-DB7 | Read-only PostgreSQL role for the AI module (AI-ARCHITECTURE §11)? | Yes |
