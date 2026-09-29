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
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Sync & Seed
```bash
# Push schema to database
npm run db:push

# Seed factory departments, users, sample order (PRG-2026-0001), rolls, challans & logs
npm run db:seed
```

### 3. Run Test Suite
```bash
npm run test --workspace=@subham/api
```

### 4. Start Development Servers
```bash
# Terminal 1: Backend API Gateway (http://localhost:3001/api)
npm run dev:api

# Terminal 2: Web Operational Portal (http://localhost:3000)
npm run dev:web
```

---

## 👥 Default Operator Credentials (Seeded)

| Persona / Station | Username | Password | Role |
| :--- | :--- | :--- | :--- |
| **Director / System Admin** | `admin` | `Admin@12345` | `SUPER_ADMIN` |
| **VP Production** | `prod_manager` | `Admin@12345` | `PRODUCTION_MANAGER` |
| **Store Supervisor** | `store_sup` | `Admin@12345` | `STORE_SUPERVISOR` |
| **Cutting Master** | `cut_sup` | `Admin@12345` | `CUTTING_SUPERVISOR` |
| **Stitching Supervisor** | `stitch_sup` | `Admin@12345` | `STITCHING_SUPERVISOR` |
| **Senior QA Inspector** | `qc_insp` | `Admin@12345` | `QC_INSPECTOR` |
| **Finishing Head** | `finish_sup` | `Admin@12345` | `FINISHING_SUPERVISOR` |
| **Packing Supervisor** | `pack_sup` | `Admin@12345` | `PACKING_SUPERVISOR` |
| **Dispatch Manager** | `dispatch_mgr` | `Admin@12345` | `DISPATCH_MANAGER` |

---

## 🐳 Production Container Deployment

```bash
cd infrastructure/docker
docker compose up -d --build
```
This launches:
- **PostgreSQL 16**: Port 5432
- **Redis 7**: Port 6379
- **NestJS API**: Port 3001
- **Next.js Web**: Port 3000
- **Nginx Reverse Proxy**: Port 80
