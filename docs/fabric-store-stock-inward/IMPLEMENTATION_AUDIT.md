# Implementation audit (2026-10-26)

What the repository actually had before the Excel stock import was built. Everything here was
checked in code or, for row counts, by read-only queries against the shared Neon database.

## Runtime architecture

- **Web app:** Next.js 15 app router (`apps/web`). Every Fabric Store screen calls **Next.js API routes**
  under `apps/web/src/app/api`, which use Prisma directly through `@subham/database`.
- **NestJS (`apps/api`):** exists and has its own inventory module on `StockLedgerEntry`, but the web
  app does not call it. `NEXT_PUBLIC_API_URL` is not set and `lib/api.ts` targets the Next routes.
  The Next.js API routes are therefore the authoritative backend for Fabric Store.
- **Deployment:** Vercel (`apps/web/vercel.json`). Request bodies are capped at 4.5 MB, functions are
  time-limited, and there is no writable persistent disk and no object storage configured.
- **Database:** PostgreSQL on Neon, schema applied with `prisma db push` or reviewed SQL files in
  `packages/database/prisma/manual-migrations`. There is no `prisma/migrations` folder.

## Fabric Store stock: source of truth

There are two stock models in the schema. Only one is in use.

| Model set | Purpose | Rows in shared DB |
|---|---|---|
| `FabricInward` + `StockLedgerEntry` (department `STORE`) via `lib/fabric-stock-ledger.ts` | Received stock per fabric, type, colour and unit; challan issues and manual outward deduct through the ledger with idempotent postings | 8 inward rows, 5 ledger rows |
| `FabricBatch`, `FabricStoreRoll`, `MaterialReceipt`, `FabricStockLedger`, `InventoryLocation` | Roll/GRN workflow (Material Receipt pages) | 0 in every table |
| `Fabric`, `Supplier`, `Item` masters | Material masters | 0 in every table |

Total Stock, challan stock checks and Inward/Outward Stock all read the first set, so the import
posts there. The roll/GRN tables would be a second, parallel engine: they don't feed Total Stock or
challan checks, so the import does not write to them.

## Identity and masters

- A fabric is identified today by the **name** stored in `FabricInward.itemName`. The cleaned,
  lower-cased name is the key, the same one used for stock buckets. No fabric codes exist.
- Suppliers are free text (`FabricInward.supplierName`).
- There is one Fabric Store with no warehouses. Racks are not modelled.
- Units are `MTR` and `PCS` only. There is no conversion between them.

## Authentication and RBAC

- A signed session cookie; `lib/auth/require-user.ts` re-reads the user and roles on every request.
- Department guards come from `requireDepartment()` in `lib/auth/department-access.ts`.
- **Store department:** codes `STORE`, `FABRIC_STORE` and others; roles `FABRIC_STORE`, `STORE_MANAGER`,
  `STORE_OPERATOR`, `STORE_INCHARGE` and `FABRIC_STORE_INCHARGE`.
- **Live data:** one Store user, holding role `FABRIC_STORE`.
- `AuditLog` exists and is written by several routes.

## Uploads, documents and OCR

- There was no upload or document-processing code, no spreadsheet library, no OCR and no object
  storage. `busboy` is present only as a transitive dependency.

## Tests and CI

- Tests are `node --test` scripts under `scripts/`, which use in-memory Prisma stand-ins.
- `.github/workflows/ci.yml` runs `npm run test --workspace=@subham/api`, which is a placeholder that
  prints "passed".
- No test database. No ESLint installed or configured, so `next lint` cannot run.

## Decisions taken with the user (2026-10-26)

1. **Fabric identity:** match the names already in stock exactly. A name never received before stays
   unresolved until it is mapped to an existing fabric, or an approver explicitly accepts it as new.
2. **OCR:** Excel only for now. Images embedded in the workbook are kept as evidence, and OCR is
   documented as a later, pluggable step.
3. **Test database:** a dedicated Neon branch, given as `TEST_DATABASE_URL` in `apps/web/.env.test`.
4. **Roll uniqueness:** supplier + roll number.
