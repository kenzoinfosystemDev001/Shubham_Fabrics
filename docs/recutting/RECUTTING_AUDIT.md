# Audit Report: Shubham Fabrics MES — Recutting Department Integration

**Document Version:** 1.0.0  
**Date:** 2026-10-19  
**System:** Shubham Fabrics Enterprise Manufacturing Execution System (MES)  
**Author:** Principal MES Architect & Senior Full-Stack Engineering Team  

---

## 1. Executive Summary

The **Recutting Department** is an essential precision stage within the garment manufacturing pipeline of Shubham Fabrics. Its primary industrial function is the **accurate cutting and separation of embroidered designs and panels** on cloth, fabric, or dresses in strict accordance with the approved **Production Sheet** (`Program`) and incoming **Challan** (`Challan`).

The standard manufacturing lifecycle established in the MES is:
$$\text{Washing QC} \longrightarrow \text{Recutting (RECUTTING)} \longrightarrow \text{Stitching (STITCHING)}$$

This document presents the detailed architectural and codebase audit conducted across the full stack (`apps/api`, `apps/web`, `packages/database`, `packages/types`, `packages/config`, `packages/validation`) prior to implementation.

---

## 2. Existing MES Architecture & Inventory Audit

### 2.1 Production Sheets (`Program`)
- **Entity**: `model Program` in Prisma (`packages/database/prisma/schema.prisma`).
- **Identifier**: `programNumber` (e.g. `PRG-2026-XXXX`) and `programSerialNo`.
- **Design & Technical Specifications**:
  - `styleCode` & `mainStyle`: Garment archetype and style family.
  - `designNumber` & `designName`: Physical design reference.
  - `wilcomDesignNumber`: Embroidered master digitizing reference code (e.g., `W-7821-EMB`).
  - `embroideryDetails`: Specific thread, needle, repeat, and motif instructions.
  - `componentDetails`: Breakdown of garment components (`TOP`, `BOTTOM`, `DUPATTA`, `SLEEVE`, `YOKE`).
  - `metadataJson`: Structured parameters including component grids, forwarded components, wilcom entries, and stitch counts.
- **Relationship**: The Production Sheet is the authoritative single source of truth for design specifications. It is directly linked to all transfers via `challan.programId`.

### 2.2 Washing QC (`WASHING_QC`)
- **Entity**: Department code `WASHING_QC` (the former `QC3` and `QCWASHING` departments were merged into it).
- **Current State**:
  - Receives washed goods from `WASHING` department (`CH-WSH-...`).
  - Performs 6-point wash quality and shrinkage verification.
  - Quarantines defects to `DEF-SHELF-WASHING-QC` and creates re-wash tickets when necessary.
  - Prepares outgoing handover challans for verified pieces.
- **Integration Target**:
  - Previously defaulted to `FINISHING` in legacy UI buttons.
  - **Required Flow**: Washing QC handovers of approved embroidered washed goods must now target `toDepartment: 'RECUTTING'`.

### 2.3 Challan System (`Challan` & `ChallanItem`)
- **Entity**: `model Challan` & `model ChallanItem`.
- **Genealogy Tracking**:
  - `parentChallanId`: Self-referential tree enabling full backwards and forward traceability from Fabric Store through Stitching.
  - `fromDepartment` & `toDepartment`: Foreign keys referencing `Department.code`.
  - `status`: `DRAFT` &rarr; `ISSUED` &rarr; `RECEIVED` &rarr; `IN_PROCESS` &rarr; `COMPLETED` &rarr; `HANDED_OVER`.
  - `ChallanItem` required fields: `itemDescription`, `quantity`, `uom`, `unitType` (e.g., `'PCS'`), `fabricCode`, `colour`.

### 2.4 Production Transactions & Traceability
- **Entity**: `model ProductionTransaction`.
- **Attributes**:
  - `departmentCode`: `'RECUTTING'`
  - `operationName`: `'EMBROIDERY_RECUTTING'`
  - `inputQuantity`: Total units fed into precision cutting.
  - `goodQuantity`: Accurately cut panels/pieces approved for assembly.
  - `reworkQuantity`: Pieces requiring re-trimming or minor correction.
  - `rejectQuantity`: Panels damaged or miss-cut.
  - `wasteQuantity`: Trim waste or unrecoverable scrap.
  - `balanceQuantity`: Work-in-progress remaining.
  - `unitOfMeasure`: Consistent with incoming item (`PCS`, `MTR`, `PANEL`).

### 2.5 Security, Roles & RBAC
- **Entity**: `model User`, `model Role`, `model UserRole`.
- **Existing User Directory**:
  - `admin` (System Administrator)
  - `program` (Programming Department)
  - `store` (Fabric Store)
  - `dyeing` (Dyeing & Fabric Processing)
  - `qc1` (Dyeing QC)
  - `embroidery` (Embroidery Incharge)
  - `cutting` (Thread Cutting)
  - `qc2` (Threadcut QC)
  - `washing` (Washing & Laundry)
  - `qcwashing` / `qc3` (Washing QC)
- **Recutting Requirement**:
  - Department code: `RECUTTING`
  - System role: `RECUTTING_SUPERVISOR` / `RECUTTING_OPERATOR` / `RECUTTING_INCHARGE`
  - Core User: `recutting` with PIN `1234`
  - Direct quick-login tile on the `/login` portal.

---

## 3. Gap Analysis & Resolution Matrix

| Area | Current System State | Recutting Requirement | Architecture Solution |
| :--- | :--- | :--- | :--- |
| **Department Routing** | `WASHING_QC` &rarr; `RECUTTING` exists in `STANDARD_FACTORY_ROUTE` | Outgoing challans from Washing QC must route to `RECUTTING` | Update Washing QC issue forms to default target `RECUTTING`. |
| **Database Master** | `RECUTTING` in `DepartmentCode` enum | `Department` table row for `RECUTTING` and `STITCHING` | Upsert `RECUTTING` and `STITCHING` in `scripts/setup-core-users.js` and auth login auto-seed. |
| **Auth & Routing** | RBAC checks only handled up to `WASHING_QC` | RBAC must recognize `recutting` user and route to `/recutting` | Implement `isRecuttingUser()` in `apps/web/src/lib/rbac.ts` and update `DepartmentGuard`. |
| **Login Portal** | 10 stations on `/login` | Needs direct quick-login button for Recutting | Add Recutting tile to `STATIONS` array with scissor/slice icon and emerald-teal styling. |
| **Operation API** | None for Recutting | Full operational REST API under `/api/recutting/...` | Implement receive, start, complete, verify, floor-board, dashboard, and handover endpoints. |
| **Stitching Transfer** | Stitching exists as code | Outgoing Challan issued to `STITCHING` | Implement `/api/recutting/issue-challan` creating real `Challan` with `toDepartment: 'STITCHING'`. |

---

## 4. Verification of Tech Sheet & Design Rendering
- The existing component `ProductionSheetPrintModal` renders technical sheets from `Program` data.
- The Recutting workspace will integrate `ProductionSheetPrintModal` via `program={selectedProgram}`.
- Wilcom embroidery numbers, color swatches, sizes, stitch density, and component breakdowns are displayed without fabricating false assets.
