# Production fixes: challan numbers, transfer documents, fabric stock, dyeing instructions

## Deploy order

1. Apply the additive SQL to the database **before** deploying this code (the new code reads the new columns):
   ```
   cd packages/database
   npx prisma db execute --schema prisma/schema.prisma --file prisma/manual-migrations/20261024_production_fixes.sql
   ```
   The file only adds nullable columns and two indexes; no existing row changes. A read-only
   `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` against the shared
   Neon DB on 2026-10-24 showed exactly these statements and nothing else.
2. Restart the web app so it loads the regenerated Prisma client (`apps/web/src/generated/client`).

## 1. Manual challan numbers

- Root cause: `/api/challans/next-number` pre-filled numbers, and every challan-creating route generated or
  silently replaced numbers (prefix + count, `Date.now()` collision fallback).
- Now: forms start blank (`components/challan/ChallanNumberField.tsx`); every route validates with
  `lib/challan-number-server.ts` (required, printable, <= 64 chars, unused ignoring case; the unique index
  still guards races) and saves the typed value trimmed. `next-number` is removed. Inspections that issue
  several challans take one number per challan (`passChallanNumber`, `reworkChallanNumber`,
  `rejectChallanNumber`).
- `POST /api/challans` accepts `idempotencyKey`; the key is recorded in the challan's transaction
  (`IdempotencyRecord`), so a retry or double submit returns the first challan.
- Historical challans are untouched.

## 2. Transfer documents

`GET /api/challans/[id]/documents` returns that challan and the original sheet of its own program, to the
sending or receiving department, Programming and admins only. `components/common/TransferDocuments.tsx`
wraps the existing `DocumentActionButtons` on every incoming screen.

## 3. Fabric stock (MTR / PCS)

- Stock bucket = fabric + UNDYED/DYED + colour + unit. Meters and pieces are never combined.
- Inward entries carry several lines (fabric, colour, quantity, unit) per bill.
- Fabric Store challans, manual outward and inward edits post to `StockLedgerEntry` (department `STORE`)
  inside the request transaction under one advisory lock. Each posting is the difference between what the
  document should contribute and what the ledger already holds, with a unique `idempotencyKey`, so retries,
  edits, cancellations, reinstatements and deletions adjust exactly once. A change that would take a bucket
  below zero is refused.
- Inward rows recorded before colours count as "colour not recorded" stock and serve issues of that fabric
  and unit. Challans and manual outward rows recorded before the ledger are still counted from their lines.

## 4. Dyeing instructions

`ChallanItem.requiredColour` / `requiredQuantity` hold the colour to dye per line, apart from the current
`colour` / `shade`. Dyeing reads the lines from the inbound challan (`components/dyeing/DyeingInstructions.tsx`);
`DyeingOrder.targetColor` only summarizes them. The actual shade stays in `dyedColor` and is never pre-filled
from the target. Older lines show "Not specified".

## Tests

`node --test scripts/test-production-fixes.mjs`
