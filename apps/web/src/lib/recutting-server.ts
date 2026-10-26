import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { assertChallanNumbersAvailable, challanNumberErrorResponse, requireChallanNumber } from '@/lib/challan-number-server';
import {
  PROGRAM_SELECT,
  TX,
  USER_SELECT,
  WORKFLOWS,
  WORK_ITEM_INCLUDE,
  WorkRequestError,
  guarded,
  inboundWhere,
  round,
  syncWorkItems,
  textOf,
  workflowHandlers,
} from '@/lib/work-items-server';
import { OPEN_WORK_STATUSES, receivedBasis } from '@/lib/work-items.mjs';
import { MIXED_UNIT } from '@/lib/challan-units.mjs';
import {
  CATEGORY_LABEL,
  GARMENT_CATEGORIES,
  allocatedTotal,
  allocationStatusOf,
  categoryName,
  isActiveAllocation,
  readyForStitching,
  recuttingItemStatus,
  unallocated,
  validateAllocationRows,
  validateCancel,
  validateCut,
  validateStitchingLines,
} from '@/lib/recutting.mjs';

// Recutting: receive Washing QC PASS fabric, allocate it to TOP / BOTTOM / DUPATTA / OTHERS by style,
// record what was cut, and issue category/style-wise challans to Stitching. Receiving, line details,
// the Dyed/Undyed correction and history reuse the shared work-item handlers.

const cfg = WORKFLOWS.RECUTTING;
const dept = { departmentCode: cfg.code };
const generic = workflowHandlers(cfg);

const SHEET_SELECT = { ...PROGRAM_SELECT, mainStyle: true, subStyle: true } as const;
const ITEM_INCLUDE = { ...WORK_ITEM_INCLUDE, program: { select: SHEET_SELECT } };

const ALLOCATION_INCLUDE = {
  workItem: {
    select: {
      id: true,
      itemNumber: true,
      programId: true,
      departmentCode: true,
      fabricName: true,
      colour: true,
      fabricProcessingStatus: true,
      uom: true,
      status: true,
      priority: true,
      inboundChallanId: true,
      inboundChallan: { select: { id: true, challanNumber: true, issuedDate: true } },
      program: { select: SHEET_SELECT },
    },
  },
  createdBy: { select: USER_SELECT },
  transfers: {
    orderBy: { createdAt: 'asc' as const },
    include: { challan: { select: { id: true, challanNumber: true, status: true, issuedDate: true } } },
  },
};

const ALLOCATE_ENDPOINT = 'RECUTTING_ALLOCATION';
const STITCH_ENDPOINT = 'RECUTTING_STITCHING_CHALLAN';

function idempotencyKey(endpoint: string, userId: string, value: unknown) {
  return typeof value === 'string' && value.trim() ? `${endpoint}:${userId}:${value.trim().slice(0, 128)}` : null;
}

async function earlierResponse(key: string | null, endpoint: string) {
  if (!key) return null;
  const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
  return record && record.endpoint === endpoint ? (JSON.parse(record.responseBody) as Record<string, string>) : null;
}

const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === 'P2002';

/** Keeps the line's allocated total (processedQuantity) and status in step with its allocations. */
async function syncItem(tx: any, itemId: string) {
  const item = await tx.departmentWorkItem.findUnique({ where: { id: itemId }, include: { allocations: true } });
  if (!item) return;
  const status = recuttingItemStatus(item, item.allocations);
  await tx.departmentWorkItem.update({
    where: { id: itemId },
    data: {
      processedQuantity: allocatedTotal(item.allocations),
      status,
      completedAt: ['COMPLETED', 'PARTIALLY_TRANSFERRED', 'TRANSFERRED'].includes(status) ? item.completedAt ?? new Date() : null,
    },
  });
}

/** GET items?filter=pending|progress|open|all&search=  — received lines with their allocations. */
const listItems = (request: Request) =>
  guarded(request, cfg, async () => {
    await syncWorkItems(cfg);
    const p = new URL(request.url).searchParams;
    const statuses = (p.get('status') || '').split(',').map((s) => s.trim()).filter(Boolean);
    // A status list (Received Fabric page) means "these lines as they are"; otherwise default to open work.
    const filter = p.get('filter') || (statuses.length ? 'all' : 'open');
    const search = p.get('search')?.trim();
    const where: any = { ...dept, status: statuses.length ? { in: statuses } : { not: 'AWAITING_RECEIPT' } };
    if (p.get('fabricStatus')) where.fabricProcessingStatus = p.get('fabricStatus');
    if (p.get('overdue') === '1') {
      where.status = { in: OPEN_WORK_STATUSES.filter((s) => s !== 'AWAITING_RECEIPT') };
      where.program = { deliveryDate: { lt: new Date() } };
    }
    if (search) {
      where.OR = [
        { itemNumber: { contains: search, mode: 'insensitive' } },
        { fabricName: { contains: search, mode: 'insensitive' } },
        { colour: { contains: search, mode: 'insensitive' } },
        { inboundChallan: { challanNumber: { contains: search, mode: 'insensitive' } } },
        { program: { OR: [{ programNumber: { contains: search, mode: 'insensitive' } }, { programSerialNo: { contains: search, mode: 'insensitive' } }, { designNumber: { contains: search, mode: 'insensitive' } }] } },
      ];
    }
    let data = await prisma.departmentWorkItem.findMany({ where, include: ITEM_INCLUDE, orderBy: [{ createdAt: 'desc' }], take: 500 });
    if (filter === 'pending') data = data.filter((i) => allocatedTotal(i.allocations) <= 0 && receivedBasis(i) > 0);
    if (filter === 'progress') data = data.filter((i) => allocatedTotal(i.allocations) > 0 && unallocated(i, i.allocations) > 0);
    if (filter === 'open') data = data.filter((i) => unallocated(i, i.allocations) > 0);
    return NextResponse.json({ data });
  }, 'Failed to load received fabric.');

/** GET items/:id — one line with its allocations (any status). */
const getItem = (request: Request, id: string) =>
  guarded(request, cfg, async () => {
    const item = await prisma.departmentWorkItem.findFirst({ where: { id, ...dept }, include: ITEM_INCLUDE });
    if (!item) throw new WorkRequestError('Received line not found.', 404);
    return NextResponse.json({ data: item });
  }, 'Failed to load the received line.');

/**
 * POST items/:id/allocations  { idempotencyKey, rows: [{ category, otherName?, styleRef?, allocatedQuantity, cutUom, cutQuantity?, remarks? }] }
 * Allocates part of a received line; the line's unallocated balance can never go below zero.
 */
const createAllocations = (request: Request, itemId: string) =>
  guarded(request, cfg, async (user) => {
    const body = await request.json().catch(() => null);
    if (!body) throw new WorkRequestError('Invalid request.');
    const key = idempotencyKey(ALLOCATE_ENDPOINT, user.id, body.idempotencyKey);
    const replayItem = async () => {
      const earlier = await earlierResponse(key, ALLOCATE_ENDPOINT);
      if (!earlier) return null;
      const item = await prisma.departmentWorkItem.findUnique({ where: { id: earlier.workItemId }, include: ITEM_INCLUDE });
      return item ? NextResponse.json({ data: item, replayed: true }) : null;
    };
    const replayed = await replayItem();
    if (replayed) return replayed;

    const item = await prisma.departmentWorkItem.findFirst({ where: { id: itemId, ...dept }, include: { allocations: true } });
    if (!item) throw new WorkRequestError('Received line not found.', 404);
    const check = validateAllocationRows(item, item.allocations, body.rows);
    if (!check.ok) throw new WorkRequestError(check.error);
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await prisma.$transaction(async (tx) => {
          // The guard on the allocated total means two users can never allocate the same balance.
          const res = await tx.departmentWorkItem.updateMany({
            where: { id: item.id, processedQuantity: item.processedQuantity, updatedAt: item.updatedAt },
            data: { processedQuantity: round(item.processedQuantity + check.total), startedAt: item.startedAt ?? new Date() },
          });
          if (res.count !== 1) throw new WorkRequestError(`${item.itemNumber} was allocated by someone else just now. Refresh and try again.`, 409);
          const latest = await tx.workItemAllocation.findFirst({
            where: { allocationNumber: { startsWith: `RCA-${year}-` } },
            orderBy: { allocationNumber: 'desc' },
            select: { allocationNumber: true },
          });
          let seq = (parseInt(latest?.allocationNumber.split('-').pop() || '0', 10) || 0) + 1;
          const created: string[] = [];
          for (const row of check.rows) {
            const allocationNumber = `RCA-${year}-${String(seq++).padStart(4, '0')}`;
            await tx.workItemAllocation.create({
              data: {
                allocationNumber,
                workItemId: item.id,
                category: row.category,
                otherName: row.otherName,
                styleRef: row.styleRef,
                allocatedQuantity: row.allocatedQuantity,
                allocatedUom: item.uom,
                cutQuantity: row.cutQuantity,
                cutUom: row.cutUom,
                status: row.cutQuantity > 0 ? 'CUT' : 'ALLOCATED',
                remarks: row.remarks,
                createdById: user.id,
              },
            });
            created.push(`${allocationNumber} ${row.category}${row.styleRef ? ` ${row.styleRef}` : ''} ${row.allocatedQuantity} ${item.uom}`);
          }
          await syncItem(tx, item.id);
          await tx.productionTransaction.create({
            data: {
              programId: item.programId,
              challanId: item.inboundChallanId,
              departmentCode: cfg.code,
              operationName: 'RECUTTING_ALLOCATION',
              operatorId: user.id,
              inputQuantity: check.total,
              goodQuantity: check.total,
              balanceQuantity: round(unallocated(item, item.allocations) - check.total),
              unitOfMeasure: item.uom,
              notes: `${item.itemNumber}: ${created.join('; ')}`,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: 'RECUTTING_ALLOCATE',
              entity: 'DepartmentWorkItem',
              entityId: item.id,
              beforeState: JSON.stringify({ allocated: item.processedQuantity }),
              afterState: JSON.stringify({ allocated: round(item.processedQuantity + check.total), rows: check.rows }),
            },
          });
          if (key) {
            await tx.idempotencyRecord.create({ data: { key, endpoint: ALLOCATE_ENDPOINT, method: 'POST', statusCode: 201, responseBody: JSON.stringify({ workItemId: item.id }) } });
          }
        }, TX);
        break;
      } catch (error) {
        const won = await replayItem().catch(() => null);
        if (won) return won;
        // A clashing allocation number: the guard already rolled everything back, so try again.
        if (isUniqueViolation(error) && attempt < 2) {
          const fresh = await prisma.departmentWorkItem.findUnique({ where: { id: item.id }, select: { processedQuantity: true, updatedAt: true } });
          if (fresh && fresh.processedQuantity === item.processedQuantity) {
            item.updatedAt = fresh.updatedAt;
            continue;
          }
        }
        throw error;
      }
    }
    const saved = await prisma.departmentWorkItem.findUnique({ where: { id: item.id }, include: ITEM_INCLUDE });
    return NextResponse.json({ data: saved }, { status: 201 });
  }, 'Failed to save the allocation.');

/** PATCH allocations/:id  { cutQuantity?, styleRef?, remarks? } — record what was actually cut. */
const updateAllocation = (request: Request, id: string) =>
  guarded(request, cfg, async (user) => {
    const body = await request.json().catch(() => ({}));
    const a = await prisma.workItemAllocation.findFirst({ where: { id, workItem: dept } });
    if (!a) throw new WorkRequestError('Allocation not found.', 404);
    if (a.status === 'CANCELLED') throw new WorkRequestError('This allocation was cancelled.', 409);
    let cutQuantity = a.cutQuantity;
    if (body.cutQuantity !== undefined && body.cutQuantity !== null && body.cutQuantity !== '') {
      const check = validateCut(a, body.cutQuantity);
      if (!check.ok) throw new WorkRequestError(check.error);
      cutQuantity = check.cutQuantity;
    }
    const styleRef = body.styleRef !== undefined ? textOf(body.styleRef, 120) : a.styleRef;
    const remarks = body.remarks !== undefined ? textOf(body.remarks, 300) : a.remarks;
    await prisma.$transaction(async (tx) => {
      const res = await tx.workItemAllocation.updateMany({
        where: { id, updatedAt: a.updatedAt, transferredQuantity: a.transferredQuantity },
        data: { cutQuantity, styleRef, remarks, status: allocationStatusOf({ ...a, cutQuantity }) },
      });
      if (res.count !== 1) throw new WorkRequestError('This allocation was changed by someone else. Refresh and try again.', 409);
      if (cutQuantity !== a.cutQuantity) {
        const item = await tx.departmentWorkItem.findUniqueOrThrow({ where: { id: a.workItemId }, select: { programId: true, inboundChallanId: true, itemNumber: true } });
        await tx.productionTransaction.create({
          data: {
            programId: item.programId,
            challanId: item.inboundChallanId,
            departmentCode: cfg.code,
            operationName: 'RECUTTING_CUT',
            operatorId: user.id,
            inputQuantity: round(cutQuantity - a.cutQuantity),
            goodQuantity: cutQuantity,
            balanceQuantity: round(cutQuantity - a.transferredQuantity),
            unitOfMeasure: a.cutUom,
            notes: `${a.allocationNumber} (${categoryName(a)}): cut ${a.cutQuantity} -> ${cutQuantity} ${a.cutUom}`,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'RECUTTING_ALLOCATION_UPDATE',
          entity: 'WorkItemAllocation',
          entityId: id,
          beforeState: JSON.stringify({ cutQuantity: a.cutQuantity, styleRef: a.styleRef, remarks: a.remarks }),
          afterState: JSON.stringify({ cutQuantity, styleRef, remarks }),
        },
      });
      await syncItem(tx, a.workItemId);
    }, TX);
    const saved = await prisma.workItemAllocation.findUnique({ where: { id }, include: ALLOCATION_INCLUDE });
    return NextResponse.json({ data: saved });
  }, 'Failed to update the allocation.');

/** POST allocations/:id/cancel  { reason } — only before anything was issued; the quantity returns to the line. */
const cancelAllocation = (request: Request, id: string) =>
  guarded(request, cfg, async (user) => {
    const body = await request.json().catch(() => ({}));
    const a = await prisma.workItemAllocation.findFirst({ where: { id, workItem: dept } });
    if (!a) throw new WorkRequestError('Allocation not found.', 404);
    const check = validateCancel(a, body.reason);
    if (!check.ok) throw new WorkRequestError(check.error);
    const reason = textOf(body.reason, 300);
    await prisma.$transaction(async (tx) => {
      const res = await tx.workItemAllocation.updateMany({
        where: { id, status: { not: 'CANCELLED' }, transferredQuantity: 0 },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      if (res.count !== 1) throw new WorkRequestError('This allocation was changed by someone else. Refresh and try again.', 409);
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'RECUTTING_ALLOCATION_CANCEL',
          entity: 'WorkItemAllocation',
          entityId: id,
          beforeState: JSON.stringify({ status: a.status, allocatedQuantity: a.allocatedQuantity, cutQuantity: a.cutQuantity }),
          afterState: JSON.stringify({ status: 'CANCELLED', reason }),
        },
      });
      await syncItem(tx, a.workItemId);
    }, TX);
    return NextResponse.json({ message: `${a.allocationNumber} cancelled; ${a.allocatedQuantity} ${a.allocatedUom} returned to the line.` });
  }, 'Failed to cancel the allocation.');

/**
 * GET allocations?category=&status=&open=1&ready=1&itemId=&programId=&from=&to=&challan=&sheet=&design=&style=&color=&unit=
 */
const listAllocations = (request: Request) =>
  guarded(request, cfg, async () => {
    const p = new URL(request.url).searchParams;
    const f = (k: string) => p.get(k)?.trim() || '';
    const ci = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const and: any[] = [{ workItem: dept }];
    if (f('category')) and.push({ category: f('category').toUpperCase() });
    if (f('status')) and.push({ status: f('status') });
    if (p.get('open') === '1') and.push({ status: { in: ['ALLOCATED', 'CUT', 'PARTIALLY_TRANSFERRED'] } });
    if (f('itemId')) and.push({ workItemId: f('itemId') });
    if (f('programId')) and.push({ workItem: { programId: f('programId') } });
    if (f('style')) and.push({ OR: [{ styleRef: ci(f('style')) }, { otherName: ci(f('style')) }] });
    if (f('unit')) and.push({ cutUom: f('unit') });
    if (f('color')) and.push({ workItem: { colour: ci(f('color')) } });
    if (f('challan')) {
      and.push({ OR: [{ workItem: { inboundChallan: { challanNumber: ci(f('challan')) } } }, { transfers: { some: { challan: { challanNumber: ci(f('challan')) } } } }] });
    }
    if (f('sheet')) and.push({ workItem: { program: { OR: [{ programSerialNo: ci(f('sheet')) }, { programNumber: ci(f('sheet')) }] } } });
    if (f('design')) and.push({ workItem: { program: { OR: [{ designNumber: ci(f('design')) }, { wilcomDesignNumber: ci(f('design')) }] } } });
    const from = f('from') ? new Date(`${f('from')}T00:00:00`) : null;
    const to = f('to') ? new Date(`${f('to')}T23:59:59.999`) : null;
    if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
    let data = await prisma.workItemAllocation.findMany({ where: { AND: and }, include: ALLOCATION_INCLUDE, orderBy: { createdAt: 'desc' }, take: 500 });
    if (p.get('ready') === '1') data = data.filter((a) => readyForStitching(a) > 0);
    return NextResponse.json({ data });
  }, 'Failed to load allocations.');

const loadStitchingChallan = (id: string) =>
  prisma.challan.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      program: { select: SHEET_SELECT },
      parentChallan: { select: { id: true, challanNumber: true } },
      issuedBy: { select: USER_SELECT },
      workTransfers: {
        include: {
          allocation: { select: { id: true, allocationNumber: true, category: true, otherName: true, styleRef: true } },
          workItem: { select: { id: true, itemNumber: true, inboundChallan: { select: { id: true, challanNumber: true } } } },
        },
      },
    },
  });

/** GET stitching-challans?search=&category= */
const listStitchingChallans = (request: Request) =>
  guarded(request, cfg, async () => {
    const p = new URL(request.url).searchParams;
    const search = p.get('search')?.trim();
    const category = p.get('category')?.trim().toUpperCase();
    const ci = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const ids = await prisma.challan.findMany({
      where: {
        fromDepartment: cfg.code,
        toDepartment: cfg.next.code,
        challanType: cfg.next.challanType,
        ...(category ? { items: { some: { garmentCategory: category } } } : {}),
        ...(search
          ? { OR: [{ challanNumber: ci(search) }, { program: { programSerialNo: ci(search) } }, { program: { designNumber: ci(search) } }, { items: { some: { styleRef: ci(search) } } }] }
          : {}),
      },
      select: { id: true },
      orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    const data = await Promise.all(ids.map((c) => loadStitchingChallan(c.id)));
    return NextResponse.json({ data: data.filter(Boolean) });
  }, 'Failed to load Stitching challans.');

/**
 * POST stitching-challans  { idempotencyKey, challanNumber, issuedDate?, remarks?, lines: [{ allocationId, quantity, remarks? }] }
 * Issues only cut quantity not yet sent, category/style-wise, in the allocation's cut unit.
 */
const issueStitchingChallan = (request: Request) =>
  guarded(request, cfg, async (user) => {
    const body = await request.json().catch(() => null);
    if (!body) throw new WorkRequestError('Invalid request.');
    const key = idempotencyKey(STITCH_ENDPOINT, user.id, body.idempotencyKey);
    const replay = async () => {
      const earlier = await earlierResponse(key, STITCH_ENDPOINT);
      if (!earlier) return null;
      const challan = await loadStitchingChallan(earlier.challanId);
      return challan ? NextResponse.json({ data: challan, replayed: true }) : null;
    };
    const earlier = await replay();
    if (earlier) return earlier;

    let challanNumber = '';
    try {
      challanNumber = requireChallanNumber(body.challanNumber);
      const lines: Array<{ allocationId: string; quantity: unknown; remarks?: unknown }> = Array.isArray(body.lines) ? body.lines : [];
      const allocations = await prisma.workItemAllocation.findMany({
        where: { id: { in: lines.map((l) => l.allocationId) } },
        include: {
          workItem: {
            select: {
              id: true,
              itemNumber: true,
              programId: true,
              departmentCode: true,
              fabricName: true,
              colour: true,
              fabricProcessingStatus: true,
              priority: true,
              inboundChallanId: true,
              inboundChallan: { select: { challanNumber: true } },
            },
          },
        },
      });
      const byId = new Map(allocations.map((a) => [a.id, a]));
      const check = validateStitchingLines(lines, byId);
      if (!check.ok) throw new WorkRequestError(check.error);
      await assertChallanNumbersAvailable(prisma, [{ value: challanNumber }]);
      const issuedDate = body.issuedDate ? new Date(String(body.issuedDate)) : new Date();
      if (Number.isNaN(issuedDate.getTime())) throw new WorkRequestError('Challan date is not a valid date.');
      const prepared = lines.map((l) => ({ a: byId.get(l.allocationId)!, quantity: round(Number(l.quantity)), remarks: textOf(l.remarks, 300) }));
      const total = round(prepared.reduce((s, p) => s + p.quantity, 0));
      const now = new Date();

      const challanId = await prisma.$transaction(async (tx) => {
        const first = prepared[0].a.workItem;
        const challan = await tx.challan.create({
          data: {
            challanNumber,
            challanType: cfg.next.challanType,
            programId: check.programId,
            parentChallanId: first.inboundChallanId,
            fromDepartment: cfg.code,
            toDepartment: cfg.next.code,
            status: 'ISSUED',
            priority: first.priority,
            createdById: user.id,
            issuedById: user.id,
            issuedDate,
            fabricOut: check.unit === MIXED_UNIT ? null : total, // mixed units: totals come from the lines
            fabricUnit: check.unit,
            remarks: textOf(body.remarks),
          },
        });
        for (const { a, quantity, remarks } of prepared) {
          const after = round(a.transferredQuantity + quantity);
          // Guards on the sent and cut totals mean the same cut quantity is never issued twice.
          const moved = await tx.workItemAllocation.updateMany({
            where: { id: a.id, status: { not: 'CANCELLED' }, transferredQuantity: a.transferredQuantity, cutQuantity: a.cutQuantity },
            data: { transferredQuantity: after, status: allocationStatusOf({ ...a, transferredQuantity: after }) },
          });
          if (moved.count !== 1) throw new WorkRequestError(`${a.allocationNumber} changed while this challan was being issued. Refresh and try again.`, 409);
          const w = a.workItem;
          const ci = await tx.challanItem.create({
            data: {
              challanId: challan.id,
              itemDescription: `${categoryName(a)}${a.styleRef ? ` · ${a.styleRef}` : ''} — ${w.fabricName}${w.colour ? `, ${w.colour}` : ''}`,
              fabricCode: w.fabricName,
              colour: w.colour,
              fabricProcessingStatus: w.fabricProcessingStatus,
              garmentCategory: a.category,
              styleRef: a.otherName && !a.styleRef ? a.otherName : a.styleRef,
              unitType: a.cutUom === 'PCS' ? 'PCS' : 'ROLL',
              quantity,
              uom: a.cutUom,
              remarks: [
                `Category: ${categoryName(a)}`,
                a.styleRef ? `Style: ${a.styleRef}` : null,
                `Allocation: ${a.allocationNumber}`,
                `Incoming: ${w.inboundChallan.challanNumber}`,
                `Status: ${w.fabricProcessingStatus === 'DYED' ? 'Dyed' : 'Undyed'}`,
                remarks,
              ]
                .filter(Boolean)
                .join(' · '),
            },
          });
          await tx.departmentWorkTransfer.create({
            data: {
              workItemId: w.id,
              allocationId: a.id,
              challanId: challan.id,
              challanItemId: ci.id,
              quantity,
              uom: a.cutUom,
              fabricProcessingStatus: w.fabricProcessingStatus,
              kind: 'PASS',
              createdById: user.id,
            },
          });
          await tx.productionTransaction.create({
            data: {
              programId: check.programId,
              challanId: challan.id,
              departmentCode: cfg.code,
              operationName: 'RECUTTING_TO_STITCHING',
              operatorId: user.id,
              inputQuantity: quantity,
              goodQuantity: quantity,
              balanceQuantity: round(a.cutQuantity - after),
              unitOfMeasure: a.cutUom,
              notes: `${a.allocationNumber} (${categoryName(a)}${a.styleRef ? ` ${a.styleRef}` : ''}): ${quantity} ${a.cutUom} to Stitching on ${challanNumber}`,
            },
          });
        }
        for (const itemId of new Set(prepared.map((p) => p.a.workItemId))) {
          await tx.departmentWorkItem.update({ where: { id: itemId }, data: { lastTransferredAt: now } });
          await syncItem(tx, itemId);
        }
        await tx.challanEvent.create({
          data: {
            challanId: challan.id,
            fromStatus: 'DRAFT',
            toStatus: 'ISSUED',
            action: 'ISSUE',
            actorId: user.id,
            metadata: JSON.stringify(prepared.map((p) => ({ allocation: p.a.allocationNumber, category: p.a.category, style: p.a.styleRef, quantity: p.quantity, uom: p.a.cutUom }))),
          },
        });
        await tx.auditLog.create({
          data: { actorId: user.id, action: 'RECUTTING_TO_STITCHING', entity: 'Challan', entityId: challan.id, afterState: JSON.stringify({ challanNumber, total, unit: check.unit, lines: prepared.length }) },
        });
        if (key) {
          await tx.idempotencyRecord.create({ data: { key, endpoint: STITCH_ENDPOINT, method: 'POST', statusCode: 201, responseBody: JSON.stringify({ challanId: challan.id }) } });
        }
        return challan.id;
      }, TX);
      return NextResponse.json({ data: await loadStitchingChallan(challanId) }, { status: 201 });
    } catch (error) {
      const won = await replay().catch(() => null);
      if (won) return won;
      const numberResponse = challanNumberErrorResponse(error, challanNumber);
      if (numberResponse) return numberResponse;
      throw error;
    }
  }, 'Failed to issue the Stitching challan.');

type UnitTotals = Record<string, number>;
const addTo = (totals: UnitTotals, unit: string, quantity: number) => {
  if (quantity > 0) totals[unit] = round((totals[unit] || 0) + quantity);
};

/** GET dashboard — counts, and quantities kept per unit (never MTR + PCS). */
const dashboard = (request: Request) =>
  guarded(request, cfg, async () => {
    await syncWorkItems(cfg);
    const [items, pendingInward, issued, alerts] = await Promise.all([
      prisma.departmentWorkItem.findMany({
        where: { ...dept, status: { in: OPEN_WORK_STATUSES } },
        include: { program: { select: SHEET_SELECT }, inboundChallan: { select: { challanNumber: true } }, allocations: true },
      }),
      prisma.challan.count({ where: { ...inboundWhere(cfg), workItemsInbound: { some: { ...dept, status: 'AWAITING_RECEIPT' } } } }),
      prisma.challan.count({ where: { fromDepartment: cfg.code, toDepartment: cfg.next.code, challanType: cfg.next.challanType } }),
      prisma.deadlineAlert.count({ where: { departmentCode: cfg.code, status: 'ACTIVE' } }).catch(() => 0),
    ]);
    const held = items.filter((i) => i.status !== 'AWAITING_RECEIPT');
    const received: UnitTotals = {};
    const unallocatedQty: UnitTotals = {};
    for (const i of held) {
      addTo(received, i.uom, receivedBasis(i));
      addTo(unallocatedQty, i.uom, unallocated(i, i.allocations));
    }
    const categories = Object.fromEntries(
      GARMENT_CATEGORIES.map((c) => [c, { count: 0, allocated: {} as UnitTotals, cut: {} as UnitTotals, ready: {} as UnitTotals }]),
    );
    const ready: UnitTotals = {};
    let readyCount = 0;
    for (const i of items) {
      for (const a of i.allocations.filter(isActiveAllocation)) {
        if (allocationStatusOf(a) === 'TRANSFERRED') continue;
        const c = categories[a.category];
        if (!c) continue;
        c.count += 1;
        addTo(c.allocated, a.allocatedUom, a.allocatedQuantity);
        addTo(c.cut, a.cutUom, a.cutQuantity);
        addTo(c.ready, a.cutUom, readyForStitching(a));
        if (readyForStitching(a) > 0) {
          readyCount += 1;
          addTo(ready, a.cutUom, readyForStitching(a));
        }
      }
    }
    const now = Date.now();
    const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    const tasks = items
      .slice()
      .sort((a, b) => {
        const da = a.program?.deliveryDate ? new Date(a.program.deliveryDate).getTime() : Infinity;
        const db = b.program?.deliveryDate ? new Date(b.program.deliveryDate).getTime() : Infinity;
        return da - db || (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
      })
      .slice(0, 10)
      .map(({ allocations, ...i }) => ({ ...i, allocated: allocatedTotal(allocations), unallocated: unallocated(i, allocations) }));
    return NextResponse.json({
      data: {
        counts: {
          pendingInward,
          fabricReceived: held.length,
          pendingAllocation: held.filter((i) => allocatedTotal(i.allocations) <= 0 && receivedBasis(i) > 0).length,
          allocationInProgress: held.filter((i) => allocatedTotal(i.allocations) > 0 && unallocated(i, i.allocations) > 0).length,
          readyForStitching: readyCount,
          challansIssued: issued,
          deadlineAlerts: alerts,
          overdue: items.filter((i) => i.program?.deliveryDate && new Date(i.program.deliveryDate).getTime() < now).length,
        },
        quantities: { received, unallocated: unallocatedQty, ready },
        categories,
        tasks,
      },
    });
  }, 'Failed to load the Recutting dashboard.');

/** GET floor-board — lines by allocation stage, open allocations by category, ready and issued work. */
const floorBoard = (request: Request) =>
  guarded(request, cfg, async () => {
    await syncWorkItems(cfg);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const items = await prisma.departmentWorkItem.findMany({
      where: { ...dept, OR: [{ status: { not: 'TRANSFERRED' } }, { lastTransferredAt: { gte: since } }] },
      include: {
        program: { select: SHEET_SELECT },
        inboundChallan: { select: { id: true, challanNumber: true } },
        allocations: { include: { transfers: { select: { challan: { select: { id: true, challanNumber: true } } } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const stages = [
      { key: 'AWAITING_RECEIPT', label: 'Awaiting Receipt' },
      { key: 'AWAITING_ALLOCATION', label: 'Awaiting Allocation' },
      { key: 'ALLOCATING', label: 'Allocation In Progress' },
      ...GARMENT_CATEGORIES.map((c) => ({ key: c, label: `${CATEGORY_LABEL[c]} Allocation` })),
      { key: 'READY', label: 'Ready for Stitching' },
      { key: 'ISSUED', label: 'Issued to Stitching' },
    ].map((s) => ({ ...s, items: [] as any[] }));
    const byKey = new Map(stages.map((s) => [s.key, s]));
    const base = (i: (typeof items)[number]) => ({
      priority: i.priority,
      fabricName: i.fabricName,
      colour: i.colour,
      fabricProcessingStatus: i.fabricProcessingStatus,
      sourceDepartment: i.sourceDepartment,
      challan: i.inboundChallan,
      program: i.program,
    });
    for (const i of items) {
      const left = unallocated(i, i.allocations);
      if (i.status === 'AWAITING_RECEIPT') {
        byKey.get('AWAITING_RECEIPT')!.items.push({ ...base(i), id: i.id, uom: i.uom, quantity: i.expectedQuantity, href: '/recutting/my-work/incoming' });
      } else if (left > 0) {
        const key = allocatedTotal(i.allocations) > 0 ? 'ALLOCATING' : 'AWAITING_ALLOCATION';
        byKey.get(key)!.items.push({ ...base(i), id: i.id, uom: i.uom, quantity: left, href: `/recutting/my-work/allocation?itemId=${i.id}` });
      }
      for (const a of i.allocations.filter(isActiveAllocation)) {
        const status = allocationStatusOf(a);
        const card = {
          ...base(i),
          id: a.id,
          label: `${categoryName(a)}${a.styleRef ? ` · ${a.styleRef}` : ''}`,
          reference: a.allocationNumber,
          outChallans: Array.from(new Map(a.transfers.map((t) => [t.challan.id, t.challan])).values()),
        };
        if (status === 'TRANSFERRED') {
          byKey.get('ISSUED')!.items.push({ ...card, uom: a.cutUom, quantity: a.transferredQuantity, href: '/recutting/my-work/issued-challans' });
          continue;
        }
        if (status === 'ALLOCATED') {
          byKey.get(a.category)?.items.push({ ...card, uom: a.allocatedUom, quantity: a.allocatedQuantity, hint: 'Allocated, not cut', href: `/recutting/my-work/allocation-history?category=${a.category}` });
        }
        if (readyForStitching(a) > 0) {
          byKey.get('READY')!.items.push({ ...card, uom: a.cutUom, quantity: readyForStitching(a), href: '/recutting/my-work/issue-challan' });
        }
      }
    }
    return NextResponse.json({ data: { stages, generatedAt: new Date().toISOString() } });
  }, 'Failed to load the Recutting floor board.');

export const recuttingHandlers = {
  listChallans: generic.listChallans,
  receiveChallan: generic.receiveChallan,
  listItems,
  getItem,
  updateItem: generic.updateItem,
  correctFabricStatus: generic.correctFabricStatus,
  createAllocations,
  updateAllocation,
  cancelAllocation,
  listAllocations,
  listStitchingChallans,
  issueStitchingChallan,
  dashboard,
  floorBoard,
  history: generic.history,
};
