# Subham Fabrics - Production-Grade Garment MES

A real, database-backed, secure, traceable, enterprise Manufacturing Execution System (MES) engineered specifically for high-volume garment and textile manufacturing plants.

---

## 🏭 Core Manufacturing Flow & Genealogy Chain

```
PROGRAM FILE (PRG-YYYY-NNNN)
   │
   ▼
[ STORE ] ──(CH-STR)──► [ DYEING ] ──(CH-DYE)──► [ QC1 (4-Point) ]
                                                        │
   ┌────────────────────────────────────────────────────┘
   ▼
[ CUTTING ] ──(CH-CUT)──► [ EMBROIDERY ] ──(CH-EMB)──► [ THREAD CUTTING ]
                                                              │
   ┌──────────────────────────────────────────────────────────┘
   ▼
[ WASHING ] ──(CH-WSH)──► [ QC2 (Wash/Shrinkage) ] ──(CH-QC2)──► [ RECUTTING (if defect) ]
                                                                        │
   ┌────────────────────────────────────────────────────────────────────┘
   ▼
[ STITCHING ] ──(CH-STC)──► [ QC3 (Inline/End-Line) ] ──(CH-QC3)──► [ FINISHING ]
                                                                         │
   ┌─────────────────────────────────────────────────────────────────────┘
   ▼
[ BUTTON & ATTACHMENTS ] ──(CH-BTN)──► [ STEAM PRESS ] ──(CH-PRS)──► [ PACKING ]
                                                                         │
   ┌─────────────────────────────────────────────────────────────────────┘
   ▼
[ FINISHED GOODS WAREHOUSE ] ──(CH-FG)──► [ DISPATCH GATE ]
```

---

## ⚖️ Strict Production Accounting

Every production transaction across all stations enforces:

$$\mathbf{Input = Good + Rework + Reject + Waste + Balance}$$

- **Zero-Tolerance Identity**: Transactions that do not mathematically balance are rejected with HTTP 422.
- **Mandatory Defect Attribution**: Any non-zero Rework requires an approved defect code; non-zero Rejections require a scrap reason.
- **Audit-Stamped**: Original records are immutable; adjustments generate reverse audit ledger events.

---

## 📜 Challan Handoff Lifecycle

Every station-to-station material movement requires an electronic Challan (`CH-<DEPT>-YYYY-NNNNNN`):

```
DRAFT ➔ SUBMITTED ➔ ISSUED ➔ RECEIVED ➔ IN_PROCESS ➔ COMPLETED ➔ QC_PENDING ➔ QC_APPROVED ➔ HANDED_OVER ➔ CLOSED
```
*Exception Branches*: `REWORK`, `ON_HOLD`, `REJECTED`, `CANCELLED`.

Every Challan preserves:
- `programId`: Root manufacturing order
- `parentChallanId`: Antecedent handoff
- `sourceLotId`, `sourceRollId`, `sourceBundleId`: Backward genealogy to raw yarn/fabric roll

---

## 🏛️ Monorepo Architecture

```
Subham_Fabrics/
├── apps/
│   ├── api/                 # NestJS REST & WebSocket Gateway (Port 3001)
│   ├── web/                 # Next.js Operational Web Portal (Port 3000)
│   └── worker/              # Background Reconciliation Worker
├── packages/
│   ├── database/            # Prisma Schema (SQLite dev / PostgreSQL prod)
│   ├── types/               # Pure TypeScript domain contracts
│   ├── validation/          # Shared Zod validation schemas
│   ├── config/              # Standard factory routes & tolerances
│   └── ui/                  # Reusable UI component definitions
├── infrastructure/
│   ├── docker/              # Docker Compose (PostgreSQL 16, Redis 7, API, Web, Nginx)
│   ├── nginx/               # Reverse proxy & rate limiter config
│   └── monitoring/          # Prometheus metrics scrapers
└── docs/
    ├── architecture/        # Architecture Decision Records (ADRs)
    └── workflows/           # SOP-01, SOP-02, SOP-03
