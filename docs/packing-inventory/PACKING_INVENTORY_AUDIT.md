# PACKING & INVENTORY UPDATION DEPARTMENT — ARCHITECTURAL AUDIT
## Shubham Fabrics MES | Production Handover & Finished Goods Inventory

**Date:** 2026-10-23  
**Auditor:** Principal Manufacturing Execution System Architect & Senior Full-Stack Engineer  
**Scope:** Final QC → Packing → Finished Goods Warehouse Handover & Inventory Ledger Integration  
**Repository:** `https://github.com/kenzoinfosystemDev001/Shubham_Fabrics.git`  
**Target Branch:** `feature/packing-inventory-department`

---

## 1. Executive Summary

This audit assesses the codebase, database schema, domain models, authentication/RBAC policies, and service layers of Shubham Fabrics MES for implementing the final manufacturing stage: **Packing / Inventory Updation Department**.

The upstream sequence is:
$$\text{Finishing} \longrightarrow \text{Steam Press} \longrightarrow \text{Final QC (FINAL\_CHECK)} \longrightarrow \text{Packing (PACKING)} \longrightarrow \text{Finished Goods (FINISHED\_GOODS)} \longrightarrow \text{Dispatch (DISPATCH)}$$

Key findings of this audit:
1. **Zero Schema Migration Required**: All required database models (`Carton`, `CartonBundle`, `InventoryStock`, `StockLedgerEntry`, `ProductionTransaction`, `Challan`, `ChallanEvent`, `IdempotencyRecord`) are already defined in Prisma (`packages/database/prisma/schema.prisma`).
2. **Authoritative Stock Models Established**: 
   - Balance snapshot: `InventoryStock` with composite uniqueness on `[departmentCode, identifier]`.
   - Immutable audit ledger: `StockLedgerEntry` recording signed entries (`+` for receipt, `-` for issue/consumption) with reference linkages to `Challan`, `Program`, and authenticated `User`.
   - Physical package unit: `Carton` with unique `cartonNumber`, linked to `Program` and `packingChallanId`, ready for consumption by downstream `DispatchOrder`/`DispatchCarton`.
3. **Upstream Integration Established**: Final QC issues real `INTER_DEPARTMENT` challans where `fromDepartment = 'FINAL_CHECK'` and `toDepartment = 'PACKING'`, with item descriptions, colors, quantities, and barcode identifiers.
4. **Clean Implementation Path**: A clean, atomic transaction model ensures that receiving pieces, packing garments into cartons, and posting stock into finished goods are isolated, verifiable, idempotent, and reversible.

---

## 2. Existing Architecture & Production Workflow

### 2.1 Factory Route Configuration
In `packages/config/src/index.ts`:
```typescript
export const STANDARD_FACTORY_ROUTE: DepartmentCode[] = [
  ...
  DepartmentCode.STEAM_PRESS,       // Index 13
  DepartmentCode.FINAL_CHECK,       // Index 14
  DepartmentCode.PACKING,           // Index 15
  DepartmentCode.FINISHED_GOODS,    // Index 16
  DepartmentCode.DISPATCH,          // Index 17
];
```
- The route dynamically resolves downstream from `FINAL_CHECK` directly to `PACKING`.
- Handover from `PACKING` transfers inventory to `FINISHED_GOODS`, enabling staged cartons to be allocated to `DISPATCH`.

### 2.2 Domain Entities & Roles
- **Department Code**: `DepartmentCode.PACKING` ('PACKING')
- **User Role**: `UserRole.PACKING_SUPERVISOR` ('PACKING_SUPERVISOR')
- **Core User Credentials**: `packing` / `1234`
- **Department Accent Color**: Indigo / Amber (following MES design system)
- **Challan Format**: `CH-PCK-{YYYYMMDD}-{RANDOM}`

---

## 3. Existing Inventory Source of Truth

The MES repository defines two complementary, transactionally linked inventory representations:

### 3.1 Snapshotted Stock Balance (`InventoryStock`)
```prisma
model InventoryStock {
  id              String   @id @default(uuid())
  departmentCode  String   // 'FINISHED_GOODS' or 'PACKING'
  itemType        String   // 'FINISHED_GARMENT'
  identifier      String   // E.g. SKU / StyleCode-Size-Colour
  description     String
  currentQuantity Float
  uom             String   // 'PCS'
  programId       String?
  lastChallanId   String?
  updatedAt       DateTime @updatedAt
  createdAt       DateTime @default(now())

  @@unique([departmentCode, identifier])
}
```

### 3.2 Immutable Movement Ledger (`StockLedgerEntry`)
```prisma
model StockLedgerEntry {
  id             String   @id @default(uuid())
  entryType      String   // 'RECEIPT', 'ISSUE', 'RETURN', 'CONSUMPTION', 'ADJUSTMENT'
  departmentCode String   // 'FINISHED_GOODS'
  itemCode       String   // Program.styleCode or Program.programNumber
  itemName       String
  batchNumber    String?
  lotNumber      String?
  rollNumber     String?
  colour         String?
  shade          String?
  location       String?  // Storage Rack / Bin
  quantity       Float    // Signed: + for additions, - for deductions
  weightKg       Float?
  uom            String   // 'PCS'
  referenceType  String   // 'CHALLAN' | 'PRODUCTION'
  referenceId    String?  // Challan ID or Carton ID
  programId      String?
  actorId        String
  balanceAfter   Float
  notes          String?
  createdAt      DateTime @default(now())

  @@index([departmentCode, itemCode])
  @@index([programId])
}
```

### 3.3 Physical Packaging Unit (`Carton`)
```prisma
model Carton {
  id               String         @id @default(uuid())
  cartonNumber     String         @unique // E.g. CTN-2026-0001
  programId        String
  program          Program        @relation(fields: [programId], references: [id])
  packingChallanId String?
  size             String
  colour           String
  quantity         Int
  grossWeightKg    Float?
  netWeightKg      Float?
  status           String         @default("PACKED") // PACKED, IN_FG_STORE, STAGED_FOR_DISPATCH, DISPATCHED
  locationRack     String?
  locationShelf    String?
  barcode          String?        @unique
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  bundles          CartonBundle[]
  dispatchCartons  DispatchCarton[]

  @@index([cartonNumber])
  @@index([programId])
  @@index([status])
}
```

---

## 4. Final QC to Packing Handover Integration

1. **Outgoing Handover from Final QC**:
   - Final QC's endpoint `apps/web/src/app/api/final-check/issue-challan/route.ts` creates:
     - `Challan` with `fromDepartment = 'FINAL_CHECK'`, `toDepartment = 'PACKING'`, `status = 'ISSUED'`, `challanType = 'INTER_DEPARTMENT'`.
     - `ChallanItem`s detailing piece count, description, color, and barcodes.
   - Atomic verification ensures that only accepted pieces from `QualityInspection` can be transferred.
2. **Inward Receipt in Packing**:
   - Packing verifies physical count against `totalIssuedQty`.
   - On physical confirmation, status updates from `'ISSUED'` to `'RECEIVED'`.
   - Discrepancies trigger an explicit shortage log and optional `'ON_HOLD'` status flag.

---

## 5. Production Sheet & Program File Traceability

The original Production Sheet identity (`programId`) is strictly preserved across all records:
- `Challan.programId`
- `ProductionTransaction.programId`
- `Carton.programId`
- `StockLedgerEntry.programId`
- `InventoryStock.programId`

At no point is a new or duplicate `Program` or `ProductionSheet` created. The packing operation merely references the authoritative garment specification.

---

## 6. Quantity Accounting Model

For every incoming Challan with received piece count $Q_{\text{received}}$:

$$\text{Eligible To Pack} = Q_{\text{received}} - Q_{\text{already\_packed}}$$

$$\text{Total Stock Added} = \sum_{i=1}^{k} Q_{\text{packed}, i}$$

Strict Invariant:
$$\text{Remaining Pieces} + \sum \text{Packed Pieces} = Q_{\text{received}}$$

- Fractional/decimal pieces are rejected (`Number.isSafeInteger()`).
- Negative quantities are rejected.
- Packing quantity $> \text{Eligible Pieces}$ is rejected with HTTP 400.
- Re-submitting an already packed carton or completed challan is rejected via idempotency guards.

---

## 7. Risks & Mitigations

| Risk | Impact | Architectural Mitigation |
|---|---|---|
| Double-posting stock to FG inventory | Inflated inventory counts | Use DB transaction updating `InventoryStock` + inserting `StockLedgerEntry` conditioned on atomic status transition |
| Concurrent packing submissions | Oversubscription of balance | Optimistic locking via `updateMany` checking `status` and available balance within transaction |
| Disconnect between Carton and Inventory | Unlinkable warehouse packages | Both `Carton` creation and `StockLedgerEntry` reference `packingChallanId` and are created in the same transaction |
| UI state drift | Discrepancy on screen | All KPIs, balances, and carton lists are queried fresh from Postgres (`force-dynamic`) with no client-side caching |

---

## 8. Implementation Plan

- **Step 1: Core RBAC & Auth Wiring**: Update `rbac.ts`, `login/route.ts`, `DepartmentSwitcher.tsx`, `DepartmentGuard.tsx`, `Navigation.tsx`, and `login/page.tsx`.
- **Step 2: Backend Domain APIs (`apps/web/src/app/api/packing/`)**:
  - `dashboard/route.ts`: Operational KPIs, inward queue, active jobs, FG stock summary.
  - `incoming/route.ts`: Inward challans from Final QC.
  - `challans/[id]/receive/route.ts`: Physical piece receipt verification and shortage handling.
  - `queue/route.ts`: Active packing jobs.
  - `jobs/[id]/route.ts`: Job inspection and details.
  - `jobs/[id]/pack/route.ts`: Core packing execution: generates `Carton`, creates `ProductionTransaction`, updates `InventoryStock`, writes `StockLedgerEntry`, and transitions `Challan` status atomically.
  - `inventory/route.ts`: Finished goods stock view and ledger audit log.
  - `reports/route.ts`: Throughput, packaging efficiency, and warehouse breakdown.
- **Step 3: Frontend Interface (`apps/web/src/app/packing/`)**:
  - `PackingNavigation.tsx`: Standardized left sidebar with amber/indigo branding.
  - `layout.tsx`: Layout container with role guard.
  - `page.tsx`: Real-time KPI dashboard.
  - `incoming/page.tsx`: Physical inward verification and receipt modal.
  - `workspace/page.tsx` & `workspace/[id]/page.tsx`: Packing floor workstation with carton allocation, barcode generator, and live reconciliation.
  - `inventory/page.tsx`: Finished goods warehouse ledger and stock explorer.
  - `reports/page.tsx`: Shift reports and carton output analytics.
- **Step 4: Automated Testing & Verification**:
  - Unit & integration test suite (`scripts/test-packing-inventory-workflow.js`) covering 12 real workflow scenarios.
  - Type-check via `tsc --noEmit`.
- **Step 5: Documentation**: Complete 11 documentation files in `docs/packing-inventory/`.
