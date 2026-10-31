import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { departmentKeyFor, requireDepartment, type DepartmentKey } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { apiErrorResponse } from '@/lib/api-errors';
import { assertChallanNumbersAvailable, challanNumberErrorResponse, requireChallanNumber } from '@/lib/challan-number-server';
import {
  FINAL_QC_CHECKPOINTS,
  OPEN_WORK_STATUSES,
  availableFor,
  availableToProcess,
  fabricStatusForInboundLine,
  pendingReject,
  pendingRework,
  qcStageEntries,
  qcStages,
  qcStatusOf,
  readyToTransfer,
  receivedBasis,
  statusAfterTransfer,
  validateCheckpoints,
  validateInspection,
  validateProductionUpdate,
  validateTransferLines,
  validateWorkUpdate,
  workStageOf,
  workStages,
} from '@/lib/work-items.mjs';
import { INVENTORY_UNIT, LEDGER, garmentLabel } from '@/lib/inventory.mjs';
import { garmentName } from '@/lib/finished-garments.mjs';
import { ITEMS_WITH_SHEET, lineSheetId } from '@/lib/challan-sheets.mjs';
import { MIXED_UNIT, secondUnitOf } from '@/lib/challan-units.mjs';
import { lineExtrasOf, lineExtrasWriter } from '@/lib/challan-item-average';

/** How a department receives and passes on work. Add an entry to bring a new department online. */
export interface WorkflowConfig {
  key: DepartmentKey;
  code: string;
  prefix: string;
  label: string;
  /** Accepted incoming routes: sending department, optionally restricted to one challan type. */
  inbound: Array<{ from: string; challanType?: string }>;
  /** Where finished work goes. Absent for the last department (Inventory), which sends nothing onward. */
  next?: { code: string; label: string; challanType: string };
  /** Only this unit may be sent to `next` (Final QC -> Inventory: finished garments in PCS). */
  passUnit?: string;
  /** Recutting: lines are allocated to garment categories/styles, and challans are issued per allocation (lib/recutting-server). */
  allocation?: boolean;
  /** Production (Stitching): work is taken onto the floor, and defective quantity is kept apart from good. */
  production?: boolean;
  /**
   * Finished garments (Finishing onward): outgoing challans carry garments by name and image only. Each
   * line sends all of its pieces available for that challan; no quantity is taken from the request.
   */
  finishedGoods?: boolean;
  /** Page that issues the `next` challan, when not "Issue Challan to <next>". */
  issueScreen?: string;
  /** A line may not be received above the quantity dispatched on the challan (shortages are still recorded). */
  strictReceipt?: boolean;
  /** Finished garments: lines are received in whole pieces (PCS only), and every receipt is posted to the stock ledger. */
  garmentStock?: boolean;
  /** QC departments: inspection outcomes. PASS goes to `next`; REJECT and REWORK go here. */
  qc?: {
    rejectTo: { code: string; label: string; challanType: string; shelf: string };
    reworkTo: { code: string; label: string; challanType: string };
    /** Checkpoints every inspection batch records as PASS or FAIL (QualityInspectionParameter rows). */
    checkpoints?: ReadonlyArray<{ key: string; label: string }>;
  };
}

export type TransferKind = 'PASS' | 'REJECT' | 'REWORK';

/** Where a transfer of this kind goes. */
function destinationOf(cfg: WorkflowConfig, kind: TransferKind) {
  if (kind === 'REJECT' && cfg.qc) return cfg.qc.rejectTo;
  if (kind === 'REWORK' && cfg.qc) return cfg.qc.reworkTo;
  if (!cfg.next) throw new WorkRequestError(`${cfg.label} sends nothing onward.`, 404);
  return cfg.next;
}

export const WORKFLOWS = {
  EMBROIDERY: {
    key: 'EMBROIDERY',
    code: 'EMBROIDERY',
    prefix: 'EMB',
    label: 'Embroidery',
    // Route A: Dyeing QC PASS transfer (dyed). Route B: Fabric Store direct (no dyeing).
    inbound: [{ from: 'QC1', challanType: 'QC1_TO_EMBROIDERY' }, { from: 'STORE' }],
    next: { code: 'THREAD_CUTTING', label: 'Thread Cutting', challanType: 'EMBROIDERY_TO_THREAD_CUTTING' },
  },
  THREAD_CUTTING: {
    key: 'THREAD_CUTTING',
    code: 'THREAD_CUTTING',
    prefix: 'THC',
    label: 'Thread Cutting',
    // Challans issued from Embroidery's transfer screen, and Threadcut QC rework returns.
    inbound: [
      { from: 'EMBROIDERY', challanType: 'EMBROIDERY_TO_THREAD_CUTTING' },
      { from: 'QC2', challanType: 'REWORK_RETURN' },
    ],
    next: { code: 'QC2', label: 'Threadcut QC', challanType: 'THREAD_CUTTING_TO_QC2' },
  },
  WASHING: {
    key: 'WASHING',
    code: 'WASHING',
    prefix: 'WSH',
    label: 'Washing',
    // Threadcut QC PASS transfers, and Washing QC's existing re-wash returns.
    inbound: [
      { from: 'QC2', challanType: 'QC2_TO_WASHING' },
      { from: 'QC3', challanType: 'REWORK_HANDOFF' },
    ],
    // Washing QC is the existing QC3 module (/qcwashing), which takes every challan addressed to QC3.
    next: { code: 'QC3', label: 'Washing QC', challanType: 'WASHING_TO_QC3' },
  },
  // Threadcut QC keeps the historical department code QC2.
  QC2: {
    key: 'QC2',
    code: 'QC2',
    prefix: 'TCQ',
    label: 'Threadcut QC',
    inbound: [{ from: 'THREAD_CUTTING', challanType: 'THREAD_CUTTING_TO_QC2' }],
    next: { code: 'WASHING', label: 'Washing', challanType: 'QC2_TO_WASHING' },
    qc: {
      // The Fabric Store defective shelf lists DEFECT_RETURN challans (api/defective-shelves).
      rejectTo: { code: 'STORE', label: 'Fabric Store Defective Shelf', challanType: 'DEFECT_RETURN', shelf: 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)' },
      reworkTo: { code: 'THREAD_CUTTING', label: 'Thread Cutting', challanType: 'REWORK_RETURN' },
    },
  },
  RECUTTING: {
    key: 'RECUTTING',
    code: 'RECUTTING',
    prefix: 'RCT',
    label: 'Recutting',
    inbound: [{ from: 'QC3', challanType: 'QC3_TO_RECUTTING' }],
    // Stitching takes every challan addressed to STITCHING.
    next: { code: 'STITCHING', label: 'Stitching', challanType: 'RECUTTING_TO_STITCHING' },
    allocation: true,
    issueScreen: 'Generate Stitching Challan',
  },
  STITCHING: {
    key: 'STITCHING',
    code: 'STITCHING',
    prefix: 'STI',
    label: 'Stitching',
    // Only category/style-wise challans issued from Recutting's allocations.
    inbound: [{ from: 'RECUTTING', challanType: 'RECUTTING_TO_STITCHING' }],
    // Finishing takes every challan addressed to FINISHING.
    next: { code: 'FINISHING', label: 'Finishing', challanType: 'STITCHING_TO_FINISHING' },
    production: true,
  },
  FINISHING: {
    key: 'FINISHING',
    code: 'FINISHING',
    prefix: 'FIN',
    label: 'Finishing',
    // Only challans issued from Stitching's transfer screen.
    inbound: [{ from: 'STITCHING', challanType: 'STITCHING_TO_FINISHING' }],
    // Steam Press takes every challan addressed to STEAM_PRESS (Final QC follows Steam Press).
    next: { code: 'STEAM_PRESS', label: 'Steam Press', challanType: 'FINISHING_TO_STEAM_PRESS' },
    production: true,
    finishedGoods: true,
  },
  STEAM_PRESS: {
    key: 'STEAM_PRESS',
    code: 'STEAM_PRESS',
    prefix: 'SPR',
    label: 'Steam Press',
    // Challans issued from Finishing's transfer screen, and Final QC rework returns.
    inbound: [
      { from: 'FINISHING', challanType: 'FINISHING_TO_STEAM_PRESS' },
      { from: 'FINAL_CHECK', challanType: 'REWORK_RETURN' },
    ],
    next: { code: 'FINAL_CHECK', label: 'Final QC', challanType: 'STEAM_PRESS_TO_FINAL_CHECK' },
    production: true,
    finishedGoods: true,
  },
  // Final QC keeps the historical department code FINAL_CHECK (pages at /final-check).
  FINAL_CHECK: {
    key: 'FINAL_CHECK',
    code: 'FINAL_CHECK',
    prefix: 'FQC',
    label: 'Final QC',
    // Steam Press transfers; INTER_DEPARTMENT is what the earlier Steam Press module issued.
    inbound: [
      { from: 'STEAM_PRESS', challanType: 'STEAM_PRESS_TO_FINAL_CHECK' },
      { from: 'STEAM_PRESS', challanType: 'INTER_DEPARTMENT' },
    ],
    // Inventory (which includes Packing) receives finished garments in pieces only.
    next: { code: 'INVENTORY', label: 'Inventory', challanType: 'FINAL_CHECK_TO_INVENTORY' },
    passUnit: 'PCS',
    strictReceipt: true,
    finishedGoods: true,
    qc: {
      rejectTo: { code: 'STORE', label: 'Fabric Store Defective Shelf', challanType: 'DEFECT_RETURN', shelf: 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)' },
      // Reworked garments are pressed again and come back to Final QC on a normal Steam Press challan.
      reworkTo: { code: 'STEAM_PRESS', label: 'Steam Press', challanType: 'REWORK_RETURN' },
      checkpoints: FINAL_QC_CHECKPOINTS,
    },
  },
  // Inventory: the last department. Finished garments are received here, held as stock and packed
  // (Packing is a module of Inventory, lib/inventory-server.ts); nothing is sent onward.
  INVENTORY: {
    key: 'INVENTORY',
    code: 'INVENTORY',
    prefix: 'INV',
    label: 'Inventory',
    // Final QC PASS transfers. FINAL_CHECK_TO_PACKING / INTER_DEPARTMENT are what earlier Final QC
    // versions issued to Packing (moved to INVENTORY by the 20261026_inventory_department migration).
    inbound: [
      { from: 'FINAL_CHECK', challanType: 'FINAL_CHECK_TO_INVENTORY' },
      { from: 'FINAL_CHECK', challanType: 'FINAL_CHECK_TO_PACKING' },
      { from: 'FINAL_CHECK', challanType: 'INTER_DEPARTMENT' },
    ],
    strictReceipt: true,
    garmentStock: true,
  },
  // Washing QC keeps the historical department code QC3 (pages at /qcwashing).
  QC3: {
    key: 'QC3',
    code: 'QC3',
    prefix: 'WQC',
    label: 'Washing QC',
    inbound: [{ from: 'WASHING', challanType: 'WASHING_TO_QC3' }],
    // Recutting takes every challan addressed to RECUTTING.
    next: { code: 'RECUTTING', label: 'Recutting', challanType: 'QC3_TO_RECUTTING' },
    qc: {
      rejectTo: { code: 'STORE', label: 'Fabric Store Defective Shelf', challanType: 'DEFECT_RETURN', shelf: 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)' },
      // The existing re-wash return, which Washing accepts as incoming work.
      reworkTo: { code: 'WASHING', label: 'Washing', challanType: 'REWORK_HANDOFF' },
    },
  },
} satisfies Record<string, WorkflowConfig>;

/** The workflow that receives this challan line by line, if any (it must not be received generically). */
export function workflowReceiving(challan: { fromDepartment: string; toDepartment: string; challanType: string }): WorkflowConfig | null {
  const to = departmentKeyFor(challan.toDepartment);
  const from = departmentKeyFor(challan.fromDepartment);
  for (const cfg of Object.values(WORKFLOWS) as WorkflowConfig[]) {
    if (!to || to !== departmentKeyFor(cfg.code)) continue;
    if (cfg.inbound.some((r) => departmentKeyFor(r.from) === from && (!r.challanType || r.challanType === challan.challanType))) return cfg;
  }
  return null;
}

/** The screen that must issue challans on this route, if a workflow owns it (as "Department > My Work > Page"). */
export function workflowIssuing(fromDepartment: string, toDepartment: string): string | null {
  // Compare departments, not spellings: QC3 is also written QCWASHING, WASHING_QC ...
  const from = departmentKeyFor(fromDepartment);
  const to = departmentKeyFor(toDepartment);
  if (!from || !to) return null;
  for (const cfg of Object.values(WORKFLOWS) as WorkflowConfig[]) {
    if (departmentKeyFor(cfg.code) !== from) continue;
    if (cfg.next && departmentKeyFor(cfg.next.code) === to) return `${cfg.label} > My Work > ${cfg.issueScreen || `Issue Challan to ${cfg.next.label}`}`;
    if (cfg.qc && departmentKeyFor(cfg.qc.rejectTo.code) === to) return `${cfg.label} > My Work > Rejected Material`;
    if (cfg.qc && departmentKeyFor(cfg.qc.reworkTo.code) === to) return `${cfg.label} > My Work > Rework Material`;
  }
  return null;
}

const INBOUND_STATUSES = ['ISSUED', 'IN_TRANSIT', 'RECEIVED'];
export const TX = { maxWait: 15000, timeout: 30000 };
export const round = (n: number) => Math.round(n * 1000) / 1000;

export class WorkRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'WorkRequestError';
  }
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof WorkRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
  return apiErrorResponse(error, fallback);
}

export const PROGRAM_SELECT = {
  id: true,
  programNumber: true,
  programSerialNo: true,
  designNumber: true,
  wilcomDesignNumber: true,
  clientName: true,
  styleCode: true,
  deliveryDate: true,
  priority: true,
  status: true,
} as const;
export const USER_SELECT = { id: true, fullName: true, username: true } as const;
/** Challan lines in order, each with its own Production Sheet. */
export const LINES_WITH_SHEET = ITEMS_WITH_SHEET;

export const WORK_ITEM_INCLUDE = {
  program: { select: PROGRAM_SELECT },
  inboundChallan: {
    // items: the fabric width of each incoming line (shown and kept when the line is issued onward).
    select: { id: true, challanNumber: true, challanType: true, fromDepartment: true, status: true, issuedDate: true, receivedDate: true, items: { select: { id: true, width: true } } },
  },
  transfers: {
    orderBy: { createdAt: 'asc' as const },
    include: { challan: { select: { id: true, challanNumber: true, status: true, issuedDate: true } }, createdBy: { select: USER_SELECT } },
  },
  receivedBy: { select: USER_SELECT },
  inspections: { orderBy: { createdAt: 'asc' as const }, include: { inspector: { select: USER_SELECT } } },
  allocations: { orderBy: { createdAt: 'asc' as const } },
  sourceAllocation: { select: { id: true, allocationNumber: true, category: true, otherName: true } },
  sourceWorkItem: { select: { id: true, itemNumber: true, departmentCode: true, inboundChallan: { select: { challanNumber: true } } } },
};

export function inboundWhere(cfg: WorkflowConfig) {
  return {
    toDepartment: { equals: cfg.code, mode: 'insensitive' as const },
    OR: cfg.inbound.map((r) => ({ fromDepartment: r.from, ...(r.challanType ? { challanType: r.challanType } : {}) })),
  };
}

/**
 * Creates work items for valid incoming challans that have none yet: one per challan line, with
 * the line's own fabric, colour, quantity, unit and Dyed/Undyed status. New items await receipt;
 * challans already received before this existed start as received.
 */
export async function syncWorkItems(cfg: WorkflowConfig) {
  const challans = await prisma.challan.findMany({
    where: { ...inboundWhere(cfg), status: { in: INBOUND_STATUSES }, workItemsInbound: { none: { departmentCode: cfg.code } } },
    include: { items: { orderBy: { createdAt: 'asc' } }, program: { select: { priority: true } } },
    orderBy: { createdAt: 'asc' },
  });
  // Nearly every call finds nothing new; skip the remaining queries then (one less database round trip).
  if (challans.length === 0) return;
  const year = new Date().getFullYear();
  // Where each incoming line came from: the previous department's line, and the Recutting allocation
  // (directly for Recutting -> Stitching, carried along from the previous line afterwards).
  const sources = await prisma.departmentWorkTransfer.findMany({
    where: { challanItemId: { in: challans.flatMap((c) => c.items.map((i) => i.id)) } },
    select: { challanItemId: true, allocationId: true, workItemId: true, workItem: { select: { sourceAllocationId: true } } },
  });
  const sourceOf = new Map(sources.map((s) => [s.challanItemId, s]));
  const allocationOf = new Map(sources.map((s) => [s.challanItemId, s.allocationId ?? s.workItem.sourceAllocationId]));
  for (const challan of challans) {
    if (!challan.programId || challan.items.length === 0) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const latest = await prisma.departmentWorkItem.findFirst({
          where: { itemNumber: { startsWith: `${cfg.prefix}-${year}-` } },
          orderBy: { itemNumber: 'desc' },
          select: { itemNumber: true },
        });
        let seq = (parseInt(latest?.itemNumber.split('-').pop() || '0', 10) || 0) + 1;
        await prisma.$transaction(async (tx) => {
          for (const item of challan.items) {
            await tx.departmentWorkItem.create({
              data: {
                departmentCode: cfg.code,
                itemNumber: `${cfg.prefix}-${year}-${String(seq++).padStart(4, '0')}`,
                // The line's own Production Sheet (older lines: the challan's).
                programId: lineSheetId(item, challan),
                inboundChallanId: challan.id,
                inboundChallanItemId: item.id,
                sourceDepartment: challan.fromDepartment,
                fabricName: item.fabricCode || item.itemDescription,
                colour: item.colour || item.shade || null,
                fabricProcessingStatus: fabricStatusForInboundLine(challan, item),
                garmentCategory: item.garmentCategory,
                styleRef: item.styleRef,
                sourceAllocationId: allocationOf.get(item.id) ?? null,
                sourceWorkItemId: sourceOf.get(item.id)?.workItemId ?? null,
                status: challan.status === 'RECEIVED' ? 'RECEIVED' : 'AWAITING_RECEIPT',
                priority: challan.priority || challan.program?.priority || 'NORMAL',
                uom: item.uom,
                expectedQuantity: item.quantity,
              },
            });
          }
        }, TX);
        break;
      } catch (error) {
        if ((error as { code?: string } | null)?.code !== 'P2002') {
          console.error(`Could not create ${cfg.label} work for challan ${challan.challanNumber}:`, error);
          break;
        }
        const exists = await prisma.departmentWorkItem.findFirst({ where: { departmentCode: cfg.code, inboundChallanId: challan.id } });
        if (exists) break;
      }
    }
  }
}

/**
 * The received quantity of a line's second unit (its Unit quantity in the other unit), checked apart from the
 * main quantity: blank keeps the quantity sent, a line with no second unit records nothing. Strict receipt
 * departments may not receive more than was sent.
 */
export function secondReceipt(
  line: { unitQuantity: number | null; unitQuantityUom: string | null; uom: string } | null | undefined,
  raw: unknown,
  label: string,
  strict: boolean,
): { quantity: number | null; unit: string | null; discrepancy: string | null } {
  const unit = secondUnitOf(line);
  if (!line || !unit) {
    if (raw !== undefined && raw !== null && String(raw).trim() !== '' && Number(raw) !== 0) {
      throw new WorkRequestError(`${label}: this line was sent in one unit only; there is no second quantity to receive.`);
    }
    return { quantity: null, unit: null, discrepancy: null };
  }
  const sent = round(Number(line.unitQuantity) || 0);
  const value = raw === undefined || raw === null || String(raw).trim() === '' ? sent : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new WorkRequestError(`${label}: received ${unit} must be zero or more.`);
  const quantity = round(value);
  if (strict && quantity > sent) throw new WorkRequestError(`${label}: received ${quantity} ${unit} is more than the ${sent} ${unit} sent.`);
  const diff = round(quantity - sent);
  return { quantity, unit, discrepancy: diff < 0 ? `Short by ${-diff} ${unit}` : diff > 0 ? `Excess of ${diff} ${unit}` : null };
}

export async function guarded(request: Request, cfg: WorkflowConfig, fn: (user: AuthenticatedUser) => Promise<Response>, fallback: string) {
  const { user, response } = await requireDepartment(request, cfg.key);
  if (!user) return response;
  try {
    return await fn(user);
  } catch (error) {
    return errorResponse(error, fallback);
  }
}

export function textOf(v: unknown, max = 500) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new WorkRequestError('Expected completion date is not a valid date.');
  return d;
}

/** QC lines change quantities only by inspection; the plain update keeps the schedule and remarks. */
async function updateQcNotes(item: { id: string; updatedAt: Date }, body: any, actorId: string) {
  const expectedCompletionDate = parseDate(body.expectedCompletionDate);
  return prisma.$transaction(async (tx) => {
    const res = await tx.departmentWorkItem.updateMany({
      where: { id: item.id, updatedAt: item.updatedAt },
      data: {
        ...(expectedCompletionDate !== undefined ? { expectedCompletionDate } : {}),
        ...(body.remarks !== undefined ? { remarks: textOf(body.remarks) } : {}),
      },
    });
    if (res.count !== 1) throw new WorkRequestError('This record was changed by someone else. Refresh and try again.', 409);
    await tx.auditLog.create({
      data: { actorId, action: 'QC_NOTES_UPDATE', entity: 'DepartmentWorkItem', entityId: item.id, afterState: JSON.stringify({ expectedCompletionDate, remarks: body.remarks }) },
    });
    return tx.departmentWorkItem.findUnique({ where: { id: item.id }, include: WORK_ITEM_INCLUDE });
  }, TX);
}

/** All API handlers for one department workflow. */
export function workflowHandlers(cfg: WorkflowConfig) {
  const dept = { departmentCode: cfg.code };

  /** GET challans?view=pending|received|all&search= */
  const listChallans = (request: Request) =>
    guarded(request, cfg, async () => {
      await syncWorkItems(cfg);
      const p = new URL(request.url).searchParams;
      const view = p.get('view') || 'pending';
      const search = p.get('search')?.trim();
      const where: any = { AND: [inboundWhere(cfg), { workItemsInbound: { some: dept } }] };
      if (view === 'pending') where.AND.push({ workItemsInbound: { some: { ...dept, status: 'AWAITING_RECEIPT' } } });
      if (view === 'received') where.AND.push({ workItemsInbound: { none: { ...dept, status: 'AWAITING_RECEIPT' } } });
      if (search) {
        where.AND.push({
          OR: [
            { challanNumber: { contains: search, mode: 'insensitive' } },
            { program: { programNumber: { contains: search, mode: 'insensitive' } } },
            { program: { programSerialNo: { contains: search, mode: 'insensitive' } } },
            { program: { designNumber: { contains: search, mode: 'insensitive' } } },
          ],
        });
      }
      const data = await prisma.challan.findMany({
        where,
        include: {
          program: { select: PROGRAM_SELECT },
          items: LINES_WITH_SHEET,
          issuedBy: { select: USER_SELECT },
          receivedBy: { select: USER_SELECT },
          parentChallan: { select: { id: true, challanNumber: true } },
          workItemsInbound: { where: dept, include: WORK_ITEM_INCLUDE, orderBy: { itemNumber: 'asc' } },
        },
        orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });
      return NextResponse.json({ data });
    }, 'Failed to load incoming challans.');

  /**
   * POST challans/:id/receive  { lines: [{ workItemId, receivedQuantity, receivedUnitQuantity?, remarks? }], remarks? }
   * receivedQuantity is in the line's own unit; receivedUnitQuantity is the line's second quantity (its Unit
   * quantity in the other unit, MTR or PCS), recorded apart and never converted.
   */
  const receiveChallan = (request: Request, challanId: string) =>
    guarded(request, cfg, async (user) => {
      const body = await request.json().catch(() => null);
      const lines: Array<{ workItemId: string; receivedQuantity: unknown; receivedUnitQuantity?: unknown; remarks?: unknown }> = Array.isArray(body?.lines) ? body.lines : [];
      const challan = await prisma.challan.findFirst({
        where: { id: challanId, ...inboundWhere(cfg) },
        select: {
          id: true,
          challanNumber: true,
          status: true,
          items: { select: { id: true, unitQuantity: true, unitQuantityUom: true, uom: true } },
          workItemsInbound: {
            where: dept,
            select: { id: true, itemNumber: true, status: true, expectedQuantity: true, uom: true, fabricName: true, programId: true, garmentCategory: true, styleRef: true, colour: true, inboundChallanItemId: true },
          },
        },
      });
      if (!challan) throw new WorkRequestError(`Challan not found for ${cfg.label}.`, 404);
      if (['CANCELLED', 'REJECTED'].includes(challan.status)) throw new WorkRequestError(`Challan ${challan.challanNumber} is ${challan.status.toLowerCase()}.`, 409);
      const pending = challan.workItemsInbound.filter((i) => i.status === 'AWAITING_RECEIPT');
      if (pending.length === 0) throw new WorkRequestError(`Challan ${challan.challanNumber} has already been received.`, 409);

      const byId = new Map(lines.map((l) => [l.workItemId, l]));
      if (byId.size !== lines.length) throw new WorkRequestError('A line is listed twice.');
      if (lines.some((l) => !pending.some((i) => i.id === l.workItemId))) {
        throw new WorkRequestError('A line does not belong to this challan or was already received.', 409);
      }
      // Finished garments are named by what they are; everywhere else by their fabric.
      const nameOf = (item: (typeof pending)[number]) => (cfg.garmentStock ? garmentLabel(item) : item.fabricName);
      const receipts = pending.map((item, index) => {
        const line = byId.get(item.id);
        if (!line) throw new WorkRequestError(`Enter the received quantity for line ${index + 1} (${nameOf(item)}).`);
        const qty = Number(line.receivedQuantity);
        if (!Number.isFinite(qty) || qty < 0) throw new WorkRequestError(`Line ${index + 1}: received quantity must be zero or more.`);
        const received = round(qty);
        if (cfg.strictReceipt && received > round(item.expectedQuantity)) {
          throw new WorkRequestError(`Line ${index + 1} (${nameOf(item)}): received ${received} ${item.uom} is more than the ${round(item.expectedQuantity)} ${item.uom} dispatched.`);
        }
        if (cfg.garmentStock && item.uom !== INVENTORY_UNIT) {
          throw new WorkRequestError(`Line ${index + 1} (${nameOf(item)}) is in ${item.uom}; ${cfg.label} receives finished garments in pieces only.`);
        }
        if (cfg.garmentStock && !Number.isInteger(received)) throw new WorkRequestError(`Line ${index + 1}: received quantity must be a whole number of pieces.`);
        const diff = round(received - item.expectedQuantity);
        const second = secondReceipt(challan.items.find((l) => l.id === item.inboundChallanItemId), line.receivedUnitQuantity, `Line ${index + 1} (${nameOf(item)})`, Boolean(cfg.strictReceipt));
        const note = textOf(line.remarks, 300);
        const discrepancy = diff < 0 ? `Short by ${-diff} ${item.uom}` : diff > 0 ? `Excess of ${diff} ${item.uom}` : null;
        return { item, received, diff, second, remarks: [discrepancy, second.discrepancy, note].filter(Boolean).join(' · ') || null };
      });

      const now = new Date();
      await prisma.$transaction(async (tx) => {
        for (const r of receipts) {
          const res = await tx.departmentWorkItem.updateMany({
            where: { id: r.item.id, status: 'AWAITING_RECEIPT' },
            data: {
              status: 'RECEIVED',
              receivedQuantity: r.received,
              receivedUnitQuantity: r.second.quantity,
              receivedUnitQuantityUom: r.second.unit,
              receivedAt: now,
              receivedById: user.id,
              receiptRemarks: r.remarks,
            },
          });
          if (res.count !== 1) throw new WorkRequestError(`${r.item.fabricName} was received by someone else just now.`, 409);
          if (cfg.garmentStock) {
            // One receipt per line: the key makes a retried or concurrent receipt impossible to post twice.
            await tx.stockLedgerEntry.create({
              data: {
                entryType: LEDGER.RECEIPT,
                departmentCode: cfg.code,
                itemCode: r.item.itemNumber,
                itemName: garmentLabel(r.item),
                colour: r.item.colour,
                quantity: r.received,
                uom: r.item.uom,
                referenceType: 'CHALLAN',
                referenceId: challan.id,
                programId: r.item.programId,
                actorId: user.id,
                balanceAfter: r.received,
                notes: [`Received on ${challan.challanNumber}: ${r.received} of ${round(r.item.expectedQuantity)} ${r.item.uom} dispatched`, r.remarks].filter(Boolean).join(' · '),
                idempotencyKey: `${cfg.code}_RECEIPT:${r.item.id}`,
              },
            });
          }
        }
        if (!['RECEIVED', 'COMPLETED', 'CLOSED'].includes(challan.status)) {
          await tx.challan.update({ where: { id: challan.id }, data: { status: 'RECEIVED', receivedDate: now, receivedById: user.id } });
        }
        await tx.challanEvent.create({
          data: {
            challanId: challan.id,
            fromStatus: challan.status,
            toStatus: 'RECEIVED',
            action: 'RECEIVE',
            actorId: user.id,
            notes: textOf(body?.remarks),
            metadata: JSON.stringify(
              receipts.map((r) => ({ item: r.item.itemNumber, expected: r.item.expectedQuantity, received: r.received, uom: r.item.uom, receivedSecond: r.second.quantity, secondUom: r.second.unit, remarks: r.remarks })),
            ),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: `${cfg.code}_RECEIVE`,
            entity: 'Challan',
            entityId: challan.id,
            afterState: JSON.stringify({ challanNumber: challan.challanNumber, lines: receipts.map((r) => ({ item: r.item.itemNumber, received: r.received, difference: r.diff })) }),
          },
        });
      }, TX);
      const differences = receipts.filter((r) => r.diff !== 0).length;
      return NextResponse.json({
        message: `Challan ${challan.challanNumber} received${differences ? ` with ${differences} discrepanc${differences === 1 ? 'y' : 'ies'}` : ''}.`,
      });
    }, 'Failed to record the receipt.');

  /** GET items?status=a,b&stage=&open=1&overdue=1&ready=1&available=PASS|REJECT|REWORK&inspection=pending|progress&programId=&fabricStatus=&unit=&search= */
  const listItems = (request: Request) =>
    guarded(request, cfg, async () => {
      await syncWorkItems(cfg);
      const p = new URL(request.url).searchParams;
      const statuses = (p.get('status') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const where: any = { ...dept };
      if (statuses.length) where.status = { in: statuses };
      else if (p.get('open') === '1' || p.get('overdue') === '1') where.status = { in: OPEN_WORK_STATUSES };
      if (p.get('programId')) where.programId = p.get('programId');
      if (p.get('fabricStatus')) where.fabricProcessingStatus = p.get('fabricStatus');
      if (p.get('unit')) where.uom = p.get('unit');
      if (p.get('category')) where.garmentCategory = p.get('category')!.toUpperCase();
      if (p.get('style')) where.styleRef = { contains: p.get('style')!, mode: 'insensitive' };
      if (p.get('overdue') === '1') where.program = { deliveryDate: { lt: new Date() } };
      const search = p.get('search')?.trim();
      if (search) {
        where.OR = [
          { itemNumber: { contains: search, mode: 'insensitive' } },
          { fabricName: { contains: search, mode: 'insensitive' } },
          { colour: { contains: search, mode: 'insensitive' } },
          { inboundChallan: { challanNumber: { contains: search, mode: 'insensitive' } } },
          { program: { OR: [{ programNumber: { contains: search, mode: 'insensitive' } }, { programSerialNo: { contains: search, mode: 'insensitive' } }, { designNumber: { contains: search, mode: 'insensitive' } }] } },
        ];
      }
      let data = await prisma.departmentWorkItem.findMany({ where, include: WORK_ITEM_INCLUDE, orderBy: [{ createdAt: 'desc' }, { itemNumber: 'asc' }], take: 500 });
      const stage = p.get('stage');
      if (stage) data = data.filter((i) => (cfg.qc ? qcStageEntries(i).some((e: { key: string }) => e.key === stage) : workStageOf(i) === stage));
      if (p.get('ready') === '1') data = data.filter((i) => readyToTransfer(i) > 0);
      const kind = p.get('available');
      if (kind) data = data.filter((i) => availableFor(i, kind) > 0);
      // QC: lines with any quantity of this outcome (e.g. Passed Items), whether or not it has left.
      const outcome = p.get('outcome');
      if (outcome === 'PASS') data = data.filter((i) => i.passedQuantity > 0);
      if (outcome === 'REJECT') data = data.filter((i) => i.rejectedQuantity > 0);
      if (outcome === 'REWORK') data = data.filter((i) => i.reworkQuantity > 0);
      const inspection = p.get('inspection');
      if (inspection === 'pending') data = data.filter((i) => i.status !== 'AWAITING_RECEIPT' && i.processedQuantity <= 0 && availableToProcess(i) > 0);
      if (inspection === 'progress') data = data.filter((i) => i.processedQuantity > 0 && availableToProcess(i) > 0);
      if (inspection === 'open') data = data.filter((i) => i.status !== 'AWAITING_RECEIPT' && availableToProcess(i) > 0);
      return NextResponse.json({ data });
    }, 'Failed to load work items.');

  const getItem = (request: Request, id: string) =>
    guarded(request, cfg, async () => {
      const item = await prisma.departmentWorkItem.findFirst({ where: { id, ...dept }, include: WORK_ITEM_INCLUDE });
      if (!item) throw new WorkRequestError('Work item not found.', 404);
      return NextResponse.json({ data: item });
    }, 'Failed to load the work item.');

  /** PATCH items/:id  { status?, processedQuantity?, expectedCompletionDate?, remarks? } */
  const updateItem = (request: Request, id: string) =>
    guarded(request, cfg, async (user) => {
      const body = await request.json().catch(() => ({}));
      const item = await prisma.departmentWorkItem.findFirst({ where: { id, ...dept } });
      if (!item) throw new WorkRequestError('Work item not found.', 404);
      if (cfg.qc || cfg.allocation) return NextResponse.json({ data: await updateQcNotes(item, body, user.id) });
      // Production departments also record what was taken in and what was found defective.
      const production = cfg.production ? validateProductionUpdate(item, body) : null;
      if (production && !production.ok) throw new WorkRequestError(production.error);
      const check = production ?? validateWorkUpdate(item, body);
      if (!check.ok) throw new WorkRequestError(check.error);
      const taken = production?.ok ? production.takenQuantity : item.takenQuantity;
      const defect = production?.ok ? production.defectQuantity : item.defectQuantity;
      const newDefect = round(defect - item.defectQuantity);
      const defectReason = textOf(body.defectReason, 300);
      if (newDefect > 0 && !defectReason) throw new WorkRequestError('Enter the defect reason for the defective quantity.');
      let expectedCompletionDate: Date | null | undefined;
      if (body.expectedCompletionDate !== undefined) {
        expectedCompletionDate = body.expectedCompletionDate ? new Date(String(body.expectedCompletionDate)) : null;
        if (expectedCompletionDate && Number.isNaN(expectedCompletionDate.getTime())) throw new WorkRequestError('Expected completion date is not a valid date.');
      }
      const now = new Date();
      const saved = await prisma.$transaction(async (tx) => {
        const res = await tx.departmentWorkItem.updateMany({
          where: { id, updatedAt: item.updatedAt },
          data: {
            status: check.status,
            processedQuantity: check.processedQuantity,
            takenQuantity: taken,
            defectQuantity: defect,
            ...(expectedCompletionDate !== undefined ? { expectedCompletionDate } : {}),
            ...(body.remarks !== undefined ? { remarks: textOf(body.remarks) } : {}),
            startedAt: item.startedAt ?? (check.status !== 'RECEIVED' ? now : null),
            completedAt: ['COMPLETED', 'READY_FOR_TRANSFER', 'PARTIALLY_TRANSFERRED'].includes(check.status) ? item.completedAt ?? now : null,
          },
        });
        if (res.count !== 1) throw new WorkRequestError('This record was changed by someone else. Refresh and try again.', 409);
        if (newDefect > 0) {
          // The existing defect workflow: a DefectRecord (listed on the defective shelves), kept
          // apart from the good completed quantity.
          await tx.defectRecord.create({
            data: {
              defectCode: `DEF-${cfg.code}-${item.itemNumber}-${Date.now().toString(36).toUpperCase()}`,
              programId: item.programId,
              challanId: item.inboundChallanId,
              departmentCode: cfg.code,
              itemDescription: [item.garmentCategory, item.styleRef, item.fabricName, item.colour].filter(Boolean).join(' · '),
              severity: 'MAJOR',
              quantity: newDefect,
              uom: item.uom,
              reason: defectReason!,
              detectedById: user.id,
              status: 'OPEN',
              resolutionNotes: `${item.itemNumber}: ${newDefect} ${item.uom} found defective in ${cfg.label}.`,
            },
          });
        }
        if (production?.ok && (taken !== item.takenQuantity || newDefect > 0)) {
          await tx.productionTransaction.create({
            data: {
              programId: item.programId,
              challanId: item.inboundChallanId,
              departmentCode: cfg.code,
              operationName: `${cfg.code}_TAKE_IN`,
              operatorId: user.id,
              inputQuantity: round(taken - item.takenQuantity),
              goodQuantity: check.processedQuantity,
              rejectQuantity: newDefect,
              rejectReason: newDefect > 0 ? defectReason : null,
              balanceQuantity: Math.max(0, round(receivedBasis(item) - taken)),
              unitOfMeasure: item.uom,
              notes: `${item.itemNumber}: taken ${item.takenQuantity} -> ${taken}, defective ${item.defectQuantity} -> ${defect} ${item.uom}`,
            },
          });
        }
        if (check.processedQuantity !== item.processedQuantity) {
          await tx.productionTransaction.create({
            data: {
              programId: item.programId,
              challanId: item.inboundChallanId,
              departmentCode: cfg.code,
              operationName: `${cfg.code}_PROCESS`,
              operatorId: user.id,
              inputQuantity: check.processedQuantity - item.processedQuantity,
              goodQuantity: check.processedQuantity,
              balanceQuantity: Math.max(0, round(receivedBasis(item) - check.processedQuantity)),
              unitOfMeasure: item.uom,
              notes: `${item.itemNumber}: processed ${item.processedQuantity} -> ${check.processedQuantity} ${item.uom}`,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: `${cfg.code}_UPDATE`,
            entity: 'DepartmentWorkItem',
            entityId: id,
            beforeState: JSON.stringify({ status: item.status, processedQuantity: item.processedQuantity, takenQuantity: item.takenQuantity, defectQuantity: item.defectQuantity }),
            afterState: JSON.stringify({ status: check.status, processedQuantity: check.processedQuantity, takenQuantity: taken, defectQuantity: defect, defectReason }),
          },
        });
        return tx.departmentWorkItem.findUnique({ where: { id }, include: WORK_ITEM_INCLUDE });
      }, TX);
      return NextResponse.json({ data: saved });
    }, 'Failed to update the work item.');

  /** PATCH items/:id/fabric-status  { fabricProcessingStatus: DYED|UNDYED, reason } — administrators only, audited. */
  const correctFabricStatus = (request: Request, id: string) =>
    guarded(request, cfg, async (user) => {
      if (!user.isAdmin) throw new WorkRequestError('Only an administrator can correct the Dyed / Undyed status.', 403);
      const body = await request.json().catch(() => ({}));
      const next = String(body.fabricProcessingStatus || '').toUpperCase();
      const reason = textOf(body.reason);
      if (next !== 'DYED' && next !== 'UNDYED') throw new WorkRequestError('Choose Dyed or Undyed.');
      if (!reason) throw new WorkRequestError('Enter the reason for the correction.');
      const item = await prisma.departmentWorkItem.findFirst({ where: { id, ...dept } });
      if (!item) throw new WorkRequestError('Work item not found.', 404);
      if (item.fabricProcessingStatus === next) throw new WorkRequestError(`It is already ${next.toLowerCase()}.`);
      if (item.transferredQuantity > 0) throw new WorkRequestError('Part of this line has already been transferred; its status can no longer change.', 409);
      const saved = await prisma.$transaction(async (tx) => {
        await tx.departmentWorkItem.update({ where: { id }, data: { fabricProcessingStatus: next, fabricStatusSource: 'CORRECTED' } });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: `${cfg.code}_FABRIC_STATUS_CORRECTED`,
            entity: 'DepartmentWorkItem',
            entityId: id,
            beforeState: JSON.stringify({ fabricProcessingStatus: item.fabricProcessingStatus }),
            afterState: JSON.stringify({ fabricProcessingStatus: next, reason }),
          },
        });
        return tx.departmentWorkItem.findUnique({ where: { id }, include: WORK_ITEM_INCLUDE });
      }, TX);
      return NextResponse.json({ data: saved });
    }, 'Failed to correct the fabric status.');

  const INSPECT_ENDPOINT = `${cfg.code}_INSPECTION`;

  /**
   * POST items/:id/inspections  { idempotencyKey, inspectedQuantity, passQuantity, rejectQuantity, reworkQuantity,
   *   rejectReason?, reworkReason?, remarks? } — QC departments only. Adds one inspection batch.
   */
  const inspectItem = (request: Request, id: string) =>
    guarded(request, cfg, async (user) => {
      if (!cfg.qc) throw new WorkRequestError(`${cfg.label} does not inspect.`, 404);
      const body = await request.json().catch(() => null);
      if (!body) throw new WorkRequestError('Invalid request.');
      const key = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim() ? `${INSPECT_ENDPOINT}:${user.id}:${body.idempotencyKey.trim().slice(0, 128)}` : null;
      const replay = async () => {
        if (!key) return null;
        const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
        if (!record || record.endpoint !== INSPECT_ENDPOINT) return null;
        const item = await prisma.departmentWorkItem.findUnique({ where: { id }, include: WORK_ITEM_INCLUDE });
        return item ? NextResponse.json({ data: item, replayed: true }) : null;
      };
      const earlier = await replay();
      if (earlier) return earlier;

      const item = await prisma.departmentWorkItem.findFirst({ where: { id, ...dept } });
      if (!item) throw new WorkRequestError('Work item not found.', 404);
      const check = validateInspection(item, body);
      if (!check.ok) throw new WorkRequestError(check.error);
      const checkpoints = cfg.qc.checkpoints ? validateCheckpoints(cfg.qc.checkpoints, body.checkpoints, check) : null;
      if (checkpoints && !checkpoints.ok) throw new WorkRequestError(checkpoints.error);
      const rejectReason = check.reject > 0 ? textOf(body.rejectReason, 300) : null;
      const reworkReason = check.rework > 0 ? textOf(body.reworkReason, 300) : null;
      const remarks = textOf(body.remarks);
      const after = {
        ...item,
        processedQuantity: round(item.processedQuantity + check.inspected),
        passedQuantity: round(item.passedQuantity + check.pass),
        rejectedQuantity: round(item.rejectedQuantity + check.reject),
        reworkQuantity: round(item.reworkQuantity + check.rework),
      };
      const status = qcStatusOf(after);
      const fullyInspected = availableToProcess(after) <= 0;
      const now = new Date();
      const outcome = check.pass === check.inspected ? 'PASS' : check.reject === check.inspected ? 'REJECT' : check.rework === check.inspected ? 'REWORK' : 'PARTIAL';

      try {
        const saved = await prisma.$transaction(async (tx) => {
          // The guard on the inspected total means two inspectors can never count the same quantity.
          const res = await tx.departmentWorkItem.updateMany({
            where: { id, processedQuantity: item.processedQuantity, updatedAt: item.updatedAt },
            data: {
              processedQuantity: after.processedQuantity,
              passedQuantity: after.passedQuantity,
              rejectedQuantity: after.rejectedQuantity,
              reworkQuantity: after.reworkQuantity,
              status,
              startedAt: item.startedAt ?? now,
              completedAt: fullyInspected ? item.completedAt ?? now : null,
            },
          });
          if (res.count !== 1) throw new WorkRequestError(`${item.fabricName} was inspected by someone else just now. Refresh and try again.`, 409);
          await tx.workItemInspection.create({
            data: {
              workItemId: id,
              inspectedQuantity: check.inspected,
              passQuantity: check.pass,
              rejectQuantity: check.reject,
              reworkQuantity: check.rework,
              uom: item.uom,
              rejectReason,
              reworkReason,
              remarks,
              inspectorId: user.id,
            },
          });
          // Shared quality records, so the Production Sheet and challan views show this inspection.
          const qi = await tx.qualityInspection.create({
            data: {
              challanId: item.inboundChallanId,
              programId: item.programId,
              departmentCode: cfg.code,
              inspectorId: user.id,
              sampleSize: Math.round(check.inspected),
              status: outcome,
              notes: [
                `${item.itemNumber}: inspected ${check.inspected} ${item.uom}, PASS ${check.pass}, REJECT ${check.reject}, REWORK ${check.rework}`,
                rejectReason ? `Reject: ${rejectReason}` : null,
                reworkReason ? `Rework: ${reworkReason}` : null,
                checkpoints?.ok ? `Checks: ${checkpoints.results.map((c) => `${c.key}=${c.result}`).join(', ')}` : null,
                remarks,
              ].filter(Boolean).join(' | '),
              inspectedAt: now,
            },
          });
          if (checkpoints?.ok) {
            await tx.qualityInspectionParameter.createMany({
              data: checkpoints.results.map((c) => ({
                inspectionId: qi.id,
                parameterName: c.key,
                expectedValue: 'PASS',
                measuredValue: c.result,
                status: c.result,
                uom: item.uom,
                comments: remarks,
              })),
            });
          }
          if (check.reject > 0) {
            await tx.defectLog.create({ data: { inspectionId: qi.id, defectType: rejectReason || 'REJECTED', count: Math.max(1, Math.round(check.reject)), severity: 'CRITICAL' } });
          }
          if (check.rework > 0) {
            await tx.defectLog.create({ data: { inspectionId: qi.id, defectType: reworkReason || 'REWORK', count: Math.max(1, Math.round(check.rework)), severity: 'MAJOR' } });
          }
          await tx.productionTransaction.create({
            data: {
              programId: item.programId,
              challanId: item.inboundChallanId,
              departmentCode: cfg.code,
              operationName: `${cfg.code}_INSPECTION`,
              operatorId: user.id,
              inputQuantity: check.inspected,
              goodQuantity: check.pass,
              rejectQuantity: check.reject,
              reworkQuantity: check.rework,
              balanceQuantity: availableToProcess(after),
              unitOfMeasure: item.uom,
              rejectReason,
              reworkReason,
              notes: `${item.itemNumber}: inspection batch ${check.inspected} ${item.uom}`,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: `${cfg.code}_INSPECTION`,
              entity: 'DepartmentWorkItem',
              entityId: id,
              beforeState: JSON.stringify({ inspected: item.processedQuantity, passed: item.passedQuantity, rejected: item.rejectedQuantity, rework: item.reworkQuantity }),
              afterState: JSON.stringify({
                inspected: after.processedQuantity,
                passed: after.passedQuantity,
                rejected: after.rejectedQuantity,
                rework: after.reworkQuantity,
                rejectReason,
                reworkReason,
                ...(checkpoints?.ok ? { checkpoints: checkpoints.results } : {}),
              }),
            },
          });
          if (key) {
            await tx.idempotencyRecord.create({ data: { key, endpoint: INSPECT_ENDPOINT, method: 'POST', statusCode: 201, responseBody: JSON.stringify({ workItemId: id }) } });
          }
          return tx.departmentWorkItem.findUnique({ where: { id }, include: WORK_ITEM_INCLUDE });
        }, TX);
        return NextResponse.json({ data: saved }, { status: 201 });
      } catch (error) {
        const won = await replay().catch(() => null);
        if (won) return won;
        throw error;
      }
    }, 'Failed to record the inspection.');

  const OUT_ENDPOINT = `${cfg.code}_TRANSFER_CHALLAN`;
  const loadOutChallan = (id: string) =>
    prisma.challan.findUnique({
      where: { id },
      include: {
        items: LINES_WITH_SHEET,
        program: { select: PROGRAM_SELECT },
        parentChallan: { select: { id: true, challanNumber: true } },
        issuedBy: { select: USER_SELECT },
        workTransfers: { include: { workItem: { select: { id: true, itemNumber: true, fabricName: true, inboundChallanId: true, inboundChallan: { select: { challanNumber: true } } } } } },
      },
    });

  const kindOf = (value: unknown): TransferKind => {
    const kind = String(value || 'PASS').toUpperCase();
    if (kind !== 'PASS' && kind !== 'REJECT' && kind !== 'REWORK') throw new WorkRequestError('Unknown transfer type.');
    if (kind !== 'PASS' && !cfg.qc) throw new WorkRequestError(`${cfg.label} has no ${kind.toLowerCase()} transfers.`);
    return kind;
  };

  /** GET transfer-challans?kind=PASS|REJECT|REWORK&search= */
  const listTransferChallans = (request: Request) =>
    guarded(request, cfg, async () => {
      const params = new URL(request.url).searchParams;
      const search = params.get('search')?.trim();
      const to = destinationOf(cfg, kindOf(params.get('kind')));
      const data = await prisma.challan.findMany({
        where: {
          fromDepartment: cfg.code,
          toDepartment: to.code,
          challanType: to.challanType,
          ...(search ? { OR: [{ challanNumber: { contains: search, mode: 'insensitive' } }, { program: { programSerialNo: { contains: search, mode: 'insensitive' } } }, { items: { some: { program: { programSerialNo: { contains: search, mode: 'insensitive' } } } } }] } : {}),
        },
        include: {
          items: LINES_WITH_SHEET,
          program: { select: PROGRAM_SELECT },
          parentChallan: { select: { id: true, challanNumber: true } },
          issuedBy: { select: USER_SELECT },
          workTransfers: { include: { workItem: { select: { id: true, itemNumber: true, inboundChallanId: true, inboundChallan: { select: { challanNumber: true } } } } } },
        },
        orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      });
      return NextResponse.json({ data });
    }, 'Failed to load outgoing challans.');

  /**
   * POST transfer-challans  { idempotencyKey, kind?, challanNumber, issuedDate?, remarks?, sourceChallanIds, lines: [{ workItemId, quantity, average?, averageUnit?, unitQuantity?, unitQuantityUom?, remarks? }] }
   * sourceChallanIds: the incoming challans selected; every line must come from one of them.
   * Moves only the quantities actually transferred, never more than processed (QC: of that outcome) and
   * not yet sent. kind (QC only): PASS -> next department, REJECT -> defective shelf, REWORK -> back for rework.
   */
  const issueTransferChallan = (request: Request) =>
    guarded(request, cfg, async (user) => {
      // Allocation departments issue per allocation (lib/recutting-server), never per line.
      if (cfg.allocation) throw new WorkRequestError(`Issue this challan from ${cfg.label} > My Work > ${cfg.issueScreen}.`);
      const body = await request.json().catch(() => null);
      if (!body) throw new WorkRequestError('Invalid request.');
      const key = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim() ? `${OUT_ENDPOINT}:${user.id}:${body.idempotencyKey.trim().slice(0, 128)}` : null;
      const replay = async () => {
        if (!key) return null;
        const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
        if (!record || record.endpoint !== OUT_ENDPOINT) return null;
        const challan = await loadOutChallan(JSON.parse(record.responseBody).challanId);
        return challan ? NextResponse.json({ data: challan, replayed: true }) : null;
      };
      const earlier = await replay();
      if (earlier) return earlier;

      let challanNumber = '';
      try {
        const kind = kindOf(body.kind);
        const to = destinationOf(cfg, kind);
        challanNumber = requireChallanNumber(body.challanNumber);
        let lines: Array<{ workItemId: string; quantity: unknown; remarks?: unknown; average?: unknown; averageUnit?: unknown; unitQuantity?: unknown; unitQuantityUom?: unknown }> = Array.isArray(body.lines) ? body.lines : [];
        const items = await prisma.departmentWorkItem.findMany({
          where: { id: { in: lines.map((l) => l.workItemId) }, ...dept },
          include: {
            inboundChallan: { select: { challanNumber: true } },
            inspections: { select: { rejectReason: true, reworkReason: true } },
            sourceAllocation: { select: { allocationNumber: true } },
          },
        });
        const byId = new Map(items.map((i) => [i.id, i]));
        // Finished garments go on whole: every piece of the chosen garments that is available for this challan.
        if (cfg.finishedGoods) {
          lines = lines.map((l) => {
            const item = byId.get(l.workItemId);
            if (item && !(availableFor(item, kind) > 0)) throw new WorkRequestError(`${garmentName(item)} has nothing left to send.`);
            return { ...l, quantity: item ? availableFor(item, kind) : 0 };
          });
        }
        // The selected incoming challans are required: a line of any other challan is refused.
        const check = validateTransferLines(lines, byId, cfg.code, kind, Array.isArray(body.sourceChallanIds) ? body.sourceChallanIds : []);
        if (!check.ok) throw new WorkRequestError(check.error);
        if (kind === 'PASS' && cfg.passUnit && check.unit !== cfg.passUnit) {
          throw new WorkRequestError(`${to.label} receives finished garments in ${cfg.passUnit} only. Record these garments in pieces before sending them; meters are never converted.`);
        }
        // Reasons recorded at inspection travel with REJECT and REWORK lines.
        const reasonsOf = (item: (typeof items)[number]) =>
          Array.from(new Set(item.inspections.map((x) => (kind === 'REJECT' ? x.rejectReason : x.reworkReason)).filter(Boolean))).join('; ');
        const counter = kind === 'REJECT' ? 'rejectSentQuantity' : kind === 'REWORK' ? 'reworkSentQuantity' : 'transferredQuantity';
        await assertChallanNumbersAvailable(prisma, cfg.code, [{ value: challanNumber }]);
        const issuedDate = body.issuedDate ? new Date(String(body.issuedDate)) : new Date();
        // Optional; the existing options only. Blank keeps the line's own priority.
        const priority = body.priority ? String(body.priority).toUpperCase() : null;
        if (priority && !['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priority)) throw new WorkRequestError('Choose a valid priority.');
        if (Number.isNaN(issuedDate.getTime())) throw new WorkRequestError('Challan date is not a valid date.');
        // Fabric width of each line's incoming line: kept unless the request names another width.
        const sourceWidths = new Map(
          (await prisma.challanItem.findMany({ where: { id: { in: items.map((i) => i.inboundChallanItemId) } }, select: { id: true, width: true } })).map((i) => [i.id, i.width]),
        );
        const prepared = lines.map((l, index) => {
          const item = byId.get(l.workItemId)!;
          const extras = lineExtrasOf(l, index, (m) => new WorkRequestError(m), sourceWidths.get(item.inboundChallanItemId) ?? null);
          return { item, quantity: round(Number(l.quantity)), extras, remarks: textOf(l.remarks, 300), reason: kind === 'PASS' ? '' : reasonsOf(item) };
        });
        const extrasOf = await lineExtrasWriter(prepared.map((p) => p.extras));
        const total = round(prepared.reduce((s, p) => s + p.quantity, 0));
        const reasons = Array.from(new Set(prepared.map((p) => p.reason).filter(Boolean))).join('; ');
        // Header parent: the first selected incoming challan used; every line also records its own source line.
        const usedSources = new Set(prepared.map((p) => p.item.inboundChallanId));
        const parentChallanId = check.sourceChallanIds.find((id) => usedSources.has(id)) || prepared[0].item.inboundChallanId;
        const now = new Date();

        const challanId = await prisma.$transaction(async (tx) => {
          const challan = await tx.challan.create({
            data: {
              challanNumber,
              challanType: to.challanType,
              programId: check.programId,
              parentChallanId,
              fromDepartment: cfg.code,
              toDepartment: to.code,
              status: 'ISSUED',
              priority: priority || prepared[0].item.priority,
              createdById: user.id,
              issuedById: user.id,
              issuedDate,
              fabricOut: kind === 'REJECT' ? 0 : check.unit === MIXED_UNIT ? null : total, // mixed units: totals come from the lines
              fabricUnit: check.unit,
              // The Fabric Store defective shelf reads these fields; the rejected quantity is counted there once.
              ...(kind === 'REJECT' && cfg.qc
                ? { defectivePieces: check.unit === MIXED_UNIT ? null : total, defectiveUnit: check.unit === MIXED_UNIT ? null : check.unit, defectiveShelfLocation: cfg.qc.rejectTo.shelf, defectReason: reasons || 'Rejected at inspection' }
                : {}),
              remarks:
                [
                  kind === 'REWORK' ? `Rework return from ${cfg.label}. Must be inspected by ${cfg.label} again after rework.` : null,
                  kind !== 'PASS' && reasons ? `Reason: ${reasons}` : null,
                  textOf(body.remarks),
                ]
                  .filter(Boolean)
                  .join(' | ') || null,
            },
          });
          // A work line sent on several entries is updated once per entry, from its running state.
          const current = new Map<string, (typeof prepared)[number]['item']>();
          for (const p of prepared) {
            const was = current.get(p.item.id) ?? p.item;
            const after = round(was[counter] + p.quantity);
            const updated = { ...was, [counter]: after };
            current.set(p.item.id, updated);
            const moved = await tx.departmentWorkItem.updateMany({
              where: { id: p.item.id, [counter]: was[counter], processedQuantity: p.item.processedQuantity },
              data: {
                [counter]: after,
                status: cfg.qc ? qcStatusOf(updated) : statusAfterTransfer(was, after),
                lastTransferredAt: now,
              },
            });
            if (moved.count !== 1) throw new WorkRequestError(`${p.item.fabricName} changed while this challan was being issued. Refresh and try again.`, 409);
            const status = p.item.fabricProcessingStatus === 'DYED' ? 'Dyed' : 'Undyed';
            const ci = await tx.challanItem.create({
              data: {
                challanId: challan.id,
                itemDescription: cfg.finishedGoods
                  ? garmentName(p.item)
                  : `${p.item.garmentCategory ? `${p.item.garmentCategory}${p.item.styleRef ? ` · ${p.item.styleRef}` : ''} — ` : ''}${p.item.fabricName} — ${p.item.colour || 'Colour not recorded'}`,
                fabricCode: p.item.fabricName,
                colour: p.item.colour,
                fabricProcessingStatus: p.item.fabricProcessingStatus,
                garmentCategory: p.item.garmentCategory,
                styleRef: p.item.styleRef,
                programId: p.item.programId,
                sourceChallanItemId: p.item.inboundChallanItemId,
                unitType: p.item.uom === 'PCS' ? 'PCS' : 'ROLL',
                quantity: p.quantity,
                uom: p.item.uom,
                ...extrasOf(p.extras),
                // "Status:" keeps the convention the stock rules already read.
                remarks: [
                  `Status: ${status}`,
                  `Incoming: ${p.item.inboundChallan.challanNumber}`,
                  p.item.sourceAllocation ? `Allocation: ${p.item.sourceAllocation.allocationNumber}` : null,
                  kind === 'REJECT' ? `Rejected at ${cfg.label}${p.reason ? `: ${p.reason}` : ''}` : null,
                  kind === 'REWORK' ? `Rework${p.reason ? `: ${p.reason}` : ''}` : null,
                  p.remarks,
                ]
                  .filter(Boolean)
                  .join(' · '),
              },
            });
            await tx.departmentWorkTransfer.create({
              data: { workItemId: p.item.id, challanId: challan.id, challanItemId: ci.id, quantity: p.quantity, uom: p.item.uom, fabricProcessingStatus: p.item.fabricProcessingStatus, kind, createdById: user.id },
            });
            await tx.productionTransaction.create({
              data: {
                programId: p.item.programId,
                challanId: challan.id,
                departmentCode: cfg.code,
                operationName: kind === 'PASS' ? `${cfg.code}_TRANSFER` : `${cfg.code}_${kind}_TRANSFER`,
                operatorId: user.id,
                inputQuantity: p.quantity,
                goodQuantity: kind === 'PASS' ? p.quantity : 0,
                rejectQuantity: kind === 'REJECT' ? p.quantity : 0,
                reworkQuantity: kind === 'REWORK' ? p.quantity : 0,
                rejectReason: kind === 'REJECT' ? p.reason || null : null,
                reworkReason: kind === 'REWORK' ? p.reason || null : null,
                balanceQuantity: availableFor(updated, kind),
                unitOfMeasure: p.item.uom,
                notes: `${p.item.itemNumber}: ${p.quantity} ${p.item.uom} to ${to.label} on ${challanNumber}`,
              },
            });
          }
          await tx.challanEvent.create({
            data: {
              challanId: challan.id,
              fromStatus: 'DRAFT',
              toStatus: 'ISSUED',
              action: 'ISSUE',
              actorId: user.id,
              metadata: JSON.stringify(prepared.map((p) => ({ item: p.item.itemNumber, kind, quantity: p.quantity, uom: p.item.uom, fabricProcessingStatus: p.item.fabricProcessingStatus }))),
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: kind === 'PASS' ? `${cfg.code}_TRANSFER` : `${cfg.code}_${kind}_TRANSFER`,
              entity: 'Challan',
              entityId: challan.id,
              afterState: JSON.stringify({ challanNumber, kind, to: to.code, total, unit: check.unit, lines: prepared.length, sheets: check.programIds, sourceChallanIds: check.sourceChallanIds }),
            },
          });
          if (key) {
            await tx.idempotencyRecord.create({ data: { key, endpoint: OUT_ENDPOINT, method: 'POST', statusCode: 201, responseBody: JSON.stringify({ challanId: challan.id }) } });
          }
          return challan.id;
        }, TX);
        return NextResponse.json({ data: await loadOutChallan(challanId) }, { status: 201 });
      } catch (error) {
        const won = await replay().catch(() => null);
        if (won) return won;
        const numberResponse = challanNumberErrorResponse(error, challanNumber);
        if (numberResponse) return numberResponse;
        throw error;
      }
    }, 'Failed to issue the challan.');

  /** GET dashboard */
  const dashboard = (request: Request) =>
    guarded(request, cfg, async () => {
      await syncWorkItems(cfg);
      const [open, pendingInward, issued, alerts, outcomeSums] = await Promise.all([
        prisma.departmentWorkItem.findMany({ where: { ...dept, status: { in: OPEN_WORK_STATUSES } }, include: { program: { select: PROGRAM_SELECT }, inboundChallan: { select: { challanNumber: true } } } }),
        prisma.challan.count({ where: { ...inboundWhere(cfg), workItemsInbound: { some: { ...dept, status: 'AWAITING_RECEIPT' } } } }),
        cfg.next ? prisma.challan.count({ where: { fromDepartment: cfg.code, toDepartment: cfg.next.code } }) : Promise.resolve(0),
        prisma.deadlineAlert.count({ where: { departmentCode: cfg.code, status: 'ACTIVE' } }).catch(() => 0),
        // QC: every inspected unit has exactly one outcome, so these sums never count a unit twice.
        cfg.qc
          ? prisma.departmentWorkItem.groupBy({
              by: ['uom'],
              where: dept,
              _sum: { passedQuantity: true, rejectedQuantity: true, reworkQuantity: true, transferredQuantity: true },
            })
          : Promise.resolve([]),
      ]);
      const sumsBy = (field: 'passedQuantity' | 'rejectedQuantity' | 'reworkQuantity' | 'transferredQuantity') =>
        Object.fromEntries(outcomeSums.map((s) => [s.uom, round(s._sum[field] || 0)]).filter(([, q]) => (q as number) > 0));
      const now = Date.now();
      const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      const tasks = open
        .slice()
        .sort((a, b) => {
          const da = a.program?.deliveryDate ? new Date(a.program.deliveryDate).getTime() : Infinity;
          const db = b.program?.deliveryDate ? new Date(b.program.deliveryDate).getTime() : Infinity;
          return da - db || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
        })
        .slice(0, 10);
      return NextResponse.json({
        data: {
          counts: {
            pendingInward,
            fabricReceived: open.filter((i) => i.status === 'RECEIVED').length,
            held: open.filter((i) => i.status !== 'AWAITING_RECEIPT').length,
            inProgress: open.filter((i) => i.status === 'IN_PROGRESS').length,
            readyForNext: open.filter((i) => readyToTransfer(i) > 0).length,
            challansIssued: issued,
            deadlineAlerts: alerts,
            overdue: open.filter((i) => i.program?.deliveryDate && new Date(i.program.deliveryDate).getTime() < now).length,
            // QC departments
            pendingInspection: open.filter((i) => i.status !== 'AWAITING_RECEIPT' && i.processedQuantity <= 0 && availableToProcess(i) > 0).length,
            inspectionInProgress: open.filter((i) => i.processedQuantity > 0 && availableToProcess(i) > 0).length,
            rejectedPending: open.filter((i) => pendingReject(i) > 0).length,
            reworkPending: open.filter((i) => pendingRework(i) > 0).length,
            completed: open.filter((i) => i.status === 'COMPLETED').length,
            partiallyCompleted: open.filter((i) => i.status === 'IN_PROGRESS' && i.processedQuantity > 0).length,
          },
          // Per unit, never MTR + PCS together.
          quantities: open.reduce(
            (acc, i) => {
              const add = (bucket: Record<string, number>, q: number) => {
                if (q > 0) bucket[i.uom] = round((bucket[i.uom] || 0) + q);
              };
              if (i.status !== 'AWAITING_RECEIPT') add(acc.received, receivedBasis(i));
              else add(acc.awaitingReceipt, i.expectedQuantity);
              add(acc.inProgress, round(Math.max(0, i.takenQuantity - i.processedQuantity - i.defectQuantity)));
              add(acc.completed, i.processedQuantity);
              add(acc.ready, readyToTransfer(i));
              if (i.status !== 'AWAITING_RECEIPT') add(acc.uninspected, availableToProcess(i));
              return acc;
            },
            {
              received: {} as Record<string, number>,
              awaitingReceipt: {} as Record<string, number>,
              inProgress: {} as Record<string, number>,
              completed: {} as Record<string, number>,
              ready: {} as Record<string, number>,
              uninspected: {} as Record<string, number>,
            },
          ),
          // QC, all time and per unit: what inspection decided, and what has left for the next department.
          outcomes: cfg.qc
            ? { passed: sumsBy('passedQuantity'), rejected: sumsBy('rejectedQuantity'), rework: sumsBy('reworkQuantity'), dispatched: sumsBy('transferredQuantity') }
            : null,
          tasks,
        },
      });
    }, `Failed to load the ${cfg.label} dashboard.`);

  /** GET floor-board — every line in one stage with the quantity that belongs to that stage. */
  const floorBoard = (request: Request) =>
    guarded(request, cfg, async () => {
      await syncWorkItems(cfg);
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const items = await prisma.departmentWorkItem.findMany({
        where: { ...dept, OR: [{ status: { not: 'TRANSFERRED' } }, { lastTransferredAt: { gte: since } }] },
        include: { program: { select: PROGRAM_SELECT }, inboundChallan: { select: { id: true, challanNumber: true } }, transfers: { select: { challan: { select: { id: true, challanNumber: true } } } } },
        orderBy: { createdAt: 'asc' },
      });
      const stages = (cfg.qc ? qcStages(cfg.next?.label ?? '', cfg.qc.reworkTo.label) : workStages(cfg.label, cfg.next?.label ?? '')).map((s: { key: string; label: string }) => ({
        ...s,
        items: [] as any[],
      }));
      const byKey = new Map(stages.map((s) => [s.key, s]));
      for (const i of items) {
        // QC lines can sit in several stages at once (e.g. passed part waiting while the rest is inspected).
        const entries: Array<{ key: string; quantity: number }> = cfg.qc ? qcStageEntries(i) : [{ key: workStageOf(i), quantity: 0 }];
        for (const { key: stage, quantity: qcQuantity } of entries) {
          const quantity = cfg.qc
            ? qcQuantity
            : stage === 'AWAITING_RECEIPT'
            ? i.expectedQuantity
            : stage === 'RECEIVED' || stage === 'PENDING' || stage === 'IN_PROGRESS' || stage === 'PARTIALLY_COMPLETED'
            ? availableToProcess(i)
            : stage === 'READY'
            ? readyToTransfer(i)
            : i.transferredQuantity;
          byKey.get(stage)?.items.push({
            id: i.id,
            itemNumber: i.itemNumber,
            status: i.status,
            priority: i.priority,
            fabricName: i.fabricName,
            colour: i.colour,
            fabricProcessingStatus: i.fabricProcessingStatus,
            garmentCategory: i.garmentCategory,
            styleRef: i.styleRef,
            sourceDepartment: i.sourceDepartment,
            uom: i.uom,
            quantity,
            processed: i.processedQuantity,
            challan: i.inboundChallan,
            outChallans: Array.from(new Map(i.transfers.map((t) => [t.challan.id, t.challan])).values()),
            program: i.program,
          });
        }
      }
      return NextResponse.json({ data: { stages, generatedAt: new Date().toISOString() } });
    }, `Failed to load the ${cfg.label} floor board.`);

  /**
   * GET history?view=lines|incoming|outgoing&from=&to=&challan=&sheet=&design=&fabric=&color=&fabricStatus=&status=
   */
  const history = (request: Request) =>
    guarded(request, cfg, async () => {
      const p = new URL(request.url).searchParams;
      const f = (k: string) => p.get(k)?.trim() || '';
      const ci = (v: string) => ({ contains: v, mode: 'insensitive' as const });
      const from = f('from') ? new Date(`${f('from')}T00:00:00`) : null;
      const to = f('to') ? new Date(`${f('to')}T23:59:59.999`) : null;
      const range = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
      const program: any[] = [];
      if (f('sheet')) program.push({ OR: [{ programSerialNo: ci(f('sheet')) }, { programNumber: ci(f('sheet')) }] });
      if (f('design')) program.push({ OR: [{ designNumber: ci(f('design')) }, { wilcomDesignNumber: ci(f('design')) }] });
      const view = p.get('view') || 'lines';

      if (view === 'inspections') {
        const item: any[] = [dept];
        if (program.length) item.push({ program: { AND: program } });
        if (f('fabric')) item.push({ fabricName: ci(f('fabric')) });
        if (f('color')) item.push({ colour: ci(f('color')) });
        if (f('fabricStatus')) item.push({ fabricProcessingStatus: f('fabricStatus') });
        if (f('challan')) item.push({ inboundChallan: { challanNumber: ci(f('challan')) } });
        const and: any[] = [{ workItem: { AND: item } }];
        if (range) and.push({ createdAt: range });
        if (f('unit')) and.push({ uom: f('unit') });
        if (f('category')) item.push({ garmentCategory: f('category').toUpperCase() });
        if (f('reason')) and.push({ OR: [{ rejectReason: ci(f('reason')) }, { reworkReason: ci(f('reason')) }] });
        const outcome = f('outcome');
        if (outcome === 'PASS') and.push({ passQuantity: { gt: 0 } });
        if (outcome === 'REJECT') and.push({ rejectQuantity: { gt: 0 } });
        if (outcome === 'REWORK') and.push({ reworkQuantity: { gt: 0 } });
        const data = await prisma.workItemInspection.findMany({
          where: { AND: and },
          include: {
            inspector: { select: USER_SELECT },
            workItem: { select: { id: true, itemNumber: true, fabricName: true, colour: true, fabricProcessingStatus: true, program: { select: PROGRAM_SELECT }, inboundChallan: { select: { id: true, challanNumber: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        return NextResponse.json({ data });
      }

      if (view === 'lines') {
        const and: any[] = [dept];
        if (range) and.push({ createdAt: range });
        if (program.length) and.push({ program: { AND: program } });
        if (f('fabric')) and.push({ fabricName: ci(f('fabric')) });
        if (f('color')) and.push({ colour: ci(f('color')) });
        if (f('fabricStatus')) and.push({ fabricProcessingStatus: f('fabricStatus') });
        if (f('status')) and.push({ status: f('status') });
        if (f('unit')) and.push({ uom: f('unit') });
        if (f('category')) and.push({ garmentCategory: f('category').toUpperCase() });
        if (f('style')) and.push({ styleRef: ci(f('style')) });
        if (f('outcome') === 'PASS') and.push({ passedQuantity: { gt: 0 } });
        if (f('outcome') === 'REJECT') and.push({ rejectedQuantity: { gt: 0 } });
        if (f('outcome') === 'REWORK') and.push({ reworkQuantity: { gt: 0 } });
        if (f('challan')) and.push({ OR: [{ inboundChallan: { challanNumber: ci(f('challan')) } }, { transfers: { some: { challan: { challanNumber: ci(f('challan')) } } } }] });
        if (f('reason')) and.push({ inspections: { some: { OR: [{ rejectReason: ci(f('reason')) }, { reworkReason: ci(f('reason')) }] } } });
        let data = await prisma.departmentWorkItem.findMany({ where: { AND: and }, include: WORK_ITEM_INCLUDE, orderBy: { createdAt: 'desc' }, take: 500 });
        // Compare two quantities on the line, which a database filter cannot express here.
        const rework = f('reworkStatus');
        if (rework === 'PENDING') data = data.filter((i) => pendingRework(i) > 0);
        if (rework === 'RETURNED') data = data.filter((i) => i.reworkQuantity > 0 && pendingRework(i) <= 0);
        const dispatch = f('dispatch');
        if (dispatch === 'AWAITING') data = data.filter((i) => readyToTransfer(i) > 0 && i.transferredQuantity <= 0);
        if (dispatch === 'PARTIAL') data = data.filter((i) => readyToTransfer(i) > 0 && i.transferredQuantity > 0);
        if (dispatch === 'DISPATCHED') data = data.filter((i) => i.transferredQuantity > 0 && readyToTransfer(i) <= 0);
        return NextResponse.json({ data });
      }

      const outgoing = cfg.qc
        ? { fromDepartment: cfg.code, OR: (['PASS', 'REJECT', 'REWORK'] as const).map((k) => ({ toDepartment: destinationOf(cfg, k).code, challanType: destinationOf(cfg, k).challanType })) }
        : { fromDepartment: cfg.code, ...(cfg.next ? { toDepartment: cfg.next.code } : {}) };
      const and: any[] = [view === 'outgoing' ? outgoing : inboundWhere(cfg)];
      if (f('unit')) and.push({ items: { some: { uom: f('unit') } } });
      if (f('category')) and.push({ items: { some: { garmentCategory: f('category').toUpperCase() } } });
      if (f('style')) and.push({ items: { some: { styleRef: ci(f('style')) } } });
      if (view === 'outgoing' && f('outcome')) {
        const to = destinationOf(cfg, kindOf(f('outcome')));
        and.push({ toDepartment: to.code, challanType: to.challanType });
      }
      if (range) and.push({ OR: [{ issuedDate: range }, { issuedDate: null, createdAt: range }] });
      if (program.length) and.push({ program: { AND: program } });
      if (f('challan')) and.push({ challanNumber: ci(f('challan')) });
      if (f('status')) and.push({ status: f('status') });
      if (f('fabric')) and.push({ items: { some: { OR: [{ fabricCode: ci(f('fabric')) }, { itemDescription: ci(f('fabric')) }] } } });
      if (f('color')) and.push({ items: { some: { colour: ci(f('color')) } } });
      if (f('fabricStatus')) {
        and.push(
          view === 'outgoing'
            ? { items: { some: { fabricProcessingStatus: f('fabricStatus') } } }
            : { workItemsInbound: { some: { ...dept, fabricProcessingStatus: f('fabricStatus') } } },
        );
      }
      const data = await prisma.challan.findMany({
        where: { AND: and },
        include: {
          items: LINES_WITH_SHEET,
          program: { select: PROGRAM_SELECT },
          parentChallan: { select: { id: true, challanNumber: true } },
          issuedBy: { select: USER_SELECT },
          receivedBy: { select: USER_SELECT },
          events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: USER_SELECT } } },
          workItemsInbound: { where: dept, select: { id: true, fabricProcessingStatus: true, inboundChallanItemId: true, receivedQuantity: true, status: true } },
        },
        orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
        take: 300,
      });
      return NextResponse.json({ data });
    }, `Failed to load ${cfg.label} history.`);

  /**
   * PATCH inspections/:inspectionId  { inspectedQuantity?, passQuantity, rejectQuantity, reworkQuantity, rejectReason?, reworkReason?, remarks?, editReason? }
   * Corrects one inspection batch. The line's inspected, passed, rejected and rework totals are recalculated from
   * it; a correction can never go below what has already left on challans (passed, rejected or reworked) nor
   * inspect more than was received, so routing and stock stay as they are.
   */
  const editInspection = (request: Request, inspectionId: string) =>
    guarded(request, cfg, async (user) => {
      if (!cfg.qc) throw new WorkRequestError(`${cfg.label} does not inspect.`, 404);
      const body = await request.json().catch(() => null);
      if (!body) throw new WorkRequestError('Invalid request.');
      const batch = await prisma.workItemInspection.findUnique({ where: { id: inspectionId }, include: { workItem: true } });
      if (!batch || batch.workItem.departmentCode !== cfg.code) throw new WorkRequestError('Inspection not found.', 404);
      const item = batch.workItem;
      const num = (v: unknown, fallback: number) => (v === undefined || v === null || v === '' ? fallback : Number(v));
      const pass = round(num(body.passQuantity, batch.passQuantity));
      const reject = round(num(body.rejectQuantity, batch.rejectQuantity));
      const rework = round(num(body.reworkQuantity, batch.reworkQuantity));
      const inspected = round(num(body.inspectedQuantity, pass + reject + rework));
      for (const [label, v] of [['Inspected', inspected], ['PASS', pass], ['REJECT', reject], ['REWORK', rework]] as const) {
        if (!Number.isFinite(v) || v < 0) throw new WorkRequestError(`${label} quantity must be zero or more.`);
      }
      if (inspected <= 0) throw new WorkRequestError('Inspected quantity must be greater than zero.');
      if (round(pass + reject + rework) !== inspected) {
        throw new WorkRequestError(`PASS + REJECT + REWORK (${round(pass + reject + rework)}) must equal the inspected quantity (${inspected} ${item.uom}).`);
      }
      const rejectReason = reject > 0 ? textOf(body.rejectReason ?? batch.rejectReason, 300) : null;
      const reworkReason = rework > 0 ? textOf(body.reworkReason ?? batch.reworkReason, 300) : null;
      if (reject > 0 && !rejectReason) throw new WorkRequestError('Enter the defect reason for the rejected quantity.');
      if (rework > 0 && !reworkReason) throw new WorkRequestError('Enter the reason for the rework quantity.');

      const after = {
        ...item,
        processedQuantity: round(item.processedQuantity - batch.inspectedQuantity + inspected),
        passedQuantity: round(item.passedQuantity - batch.passQuantity + pass),
        rejectedQuantity: round(item.rejectedQuantity - batch.rejectQuantity + reject),
        reworkQuantity: round(item.reworkQuantity - batch.reworkQuantity + rework),
      };
      const received = receivedBasis(item);
      if (after.processedQuantity > received) throw new WorkRequestError(`Only ${received} ${item.uom} was received; the line cannot be inspected beyond that.`);
      if (after.passedQuantity < round(item.transferredQuantity)) {
        throw new WorkRequestError(`${round(item.transferredQuantity)} ${item.uom} passed has already been sent on; PASS cannot go below that.`);
      }
      if (after.rejectedQuantity < round(item.rejectSentQuantity)) {
        throw new WorkRequestError(`${round(item.rejectSentQuantity)} ${item.uom} rejected has already gone to the Defective Shelf; REJECT cannot go below that.`);
      }
      if (after.reworkQuantity < round(item.reworkSentQuantity)) {
        throw new WorkRequestError(`${round(item.reworkSentQuantity)} ${item.uom} rework has already been returned; REWORK cannot go below that.`);
      }
      const status = qcStatusOf(after);
      const remarks = body.remarks !== undefined ? textOf(body.remarks) : batch.remarks;

      await prisma.$transaction(async (tx) => {
        const res = await tx.departmentWorkItem.updateMany({
          where: { id: item.id, updatedAt: item.updatedAt },
          data: {
            processedQuantity: after.processedQuantity,
            passedQuantity: after.passedQuantity,
            rejectedQuantity: after.rejectedQuantity,
            reworkQuantity: after.reworkQuantity,
            status,
            completedAt: availableToProcess(after) <= 0 ? item.completedAt ?? new Date() : null,
          },
        });
        if (res.count !== 1) throw new WorkRequestError(`${item.fabricName} changed while saving. Refresh and try again.`, 409);
        await tx.workItemInspection.update({
          where: { id: batch.id },
          data: { inspectedQuantity: inspected, passQuantity: pass, rejectQuantity: reject, reworkQuantity: rework, rejectReason, reworkReason, remarks },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: `${cfg.code}_INSPECTION_EDITED`,
            entity: 'WorkItemInspection',
            entityId: batch.id,
            beforeState: JSON.stringify({ inspected: batch.inspectedQuantity, pass: batch.passQuantity, reject: batch.rejectQuantity, rework: batch.reworkQuantity, rejectReason: batch.rejectReason, reworkReason: batch.reworkReason, remarks: batch.remarks }),
            afterState: JSON.stringify({ inspected, pass, reject, rework, rejectReason, reworkReason, remarks, reason: textOf(body.editReason) }),
          },
        });
      }, TX);
      const data = await prisma.departmentWorkItem.findUnique({ where: { id: item.id }, include: WORK_ITEM_INCLUDE });
      return NextResponse.json({ data, message: `Inspection corrected: ${inspected} ${item.uom} (PASS ${pass}, REJECT ${reject}, REWORK ${rework}).` });
    }, 'Failed to correct the inspection.');

  return {
    listChallans,
    receiveChallan,
    listItems,
    getItem,
    updateItem,
    correctFabricStatus,
    inspectItem,
    editInspection,
    listTransferChallans,
    issueTransferChallan,
    dashboard,
    floorBoard,
    history,
  };
}
