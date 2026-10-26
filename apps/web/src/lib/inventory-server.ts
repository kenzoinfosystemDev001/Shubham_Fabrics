import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { apiErrorResponse } from '@/lib/api-errors';
import { PROGRAM_SELECT, TX, USER_SELECT, WORKFLOWS, WorkRequestError, guarded, syncWorkItems, textOf, workflowHandlers } from '@/lib/work-items-server';
import {
  INVENTORY_UNIT,
  LEDGER,
  allocationOpen,
  allocationStatus,
  garmentLabel,
  inventoryStatus,
  stockOf,
  validatePacked,
  validateReturn,
  validateSendForPacking,
  workStatusOf,
} from '@/lib/inventory.mjs';
import { readGarmentImageForm, serveGarmentImage, storeGarmentImage } from '@/lib/garment-images-server';

// Inventory Department API (Packing is a module of Inventory). Receiving and incoming challans use
// the shared workflow handlers (WORKFLOWS.INVENTORY); everything here is finished-garment stock in
// whole pieces. Responses never carry fabric fields. See lib/inventory.mjs for the quantity model.

const cfg = WORKFLOWS.INVENTORY;
const dept = { departmentCode: cfg.code };
// The earlier Packing module's finished-goods ledger, shown as history only.
const LEGACY_LEDGER_DEPARTMENT = 'FINISHED_GOODS';
const MAX_ROWS = 2000;

const RECORD_INCLUDE = {
  program: { select: PROGRAM_SELECT },
  inboundChallan: { select: { id: true, challanNumber: true, issuedDate: true, receivedDate: true, issuedBy: { select: USER_SELECT } } },
  receivedBy: { select: USER_SELECT },
  packingAllocations: { orderBy: { createdAt: 'desc' as const }, select: { packingDate: true, updatedAt: true } },
};

type ImageRef = { id: string; version: number };
type ImageMap = (item: { programId: string; garmentCategory: string | null; styleRef: string | null }) => ImageRef | null;

function pageParams(p: URLSearchParams) {
  const page = Math.max(1, parseInt(p.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(p.get('pageSize') || '25', 10) || 25));
  return { page, pageSize };
}

function dateRange(p: URLSearchParams) {
  const from = p.get('from') ? new Date(`${p.get('from')}T00:00:00`) : null;
  const to = p.get('to') ? new Date(`${p.get('to')}T23:59:59.999`) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) throw new WorkRequestError('The date range is not valid.');
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
}

/**
 * Garment images for these Production Sheets: the image for the line's own style, else the one for its
 * whole category on the same sheet. Never another sheet's or another category's image.
 */
async function imagesFor(programIds: string[]): Promise<ImageMap> {
  const ids = Array.from(new Set(programIds.filter(Boolean)));
  if (ids.length === 0) return () => null;
  let rows: Array<{ id: string; programId: string; garmentCategory: string; styleRef: string; version: number }> = [];
  try {
    rows = await prisma.garmentImage.findMany({
      where: { programId: { in: ids } },
      select: { id: true, programId: true, garmentCategory: true, styleRef: true, version: true },
    });
  } catch (error) {
    // Before the migration the table does not exist: records simply show "No garment image available".
    if ((error as { code?: string } | null)?.code !== 'P2021') throw error;
  }
  const key = (p: string, c: string, s: string) => `${p}|${c}|${s}`;
  const byKey = new Map(rows.map((r) => [key(r.programId, r.garmentCategory, r.styleRef), { id: r.id, version: r.version }]));
  return (item) => {
    const category = item.garmentCategory || '';
    const style = item.styleRef || '';
    return byKey.get(key(item.programId, category, style)) || (style ? byKey.get(key(item.programId, category, '')) : undefined) || null;
  };
}

/** One finished-garment record as the screens see it: garment, quantities in pieces, references. */
function toRecord(item: any, imageOf: ImageMap) {
  const latest = item.packingAllocations?.[0];
  const activity = [item.receivedAt, latest?.updatedAt].filter(Boolean).map((d: Date) => new Date(d).getTime());
  return {
    id: item.id,
    itemNumber: item.itemNumber,
    programId: item.programId,
    program: item.program,
    inboundChallan: item.inboundChallan,
    garmentCategory: item.garmentCategory,
    styleRef: item.styleRef,
    colour: item.colour,
    garment: garmentLabel(item),
    uom: item.uom,
    dispatchedQuantity: item.expectedQuantity,
    priority: item.priority,
    receivedAt: item.receivedAt,
    receivedBy: item.receivedBy,
    receiptRemarks: item.receiptRemarks,
    status: inventoryStatus(item),
    stock: stockOf(item),
    latestPackingDate: latest?.packingDate || null,
    lastActivityAt: activity.length ? new Date(Math.max(...activity)) : null,
    image: imageOf(item),
  };
}

function allocationView(a: any, imageOf: ImageMap) {
  return {
    id: a.id,
    packingNumber: a.packingNumber,
    quantity: a.quantity,
    packedQuantity: a.packedQuantity,
    returnedQuantity: a.returnedQuantity,
    open: allocationOpen(a),
    status: allocationStatus(a),
    priority: a.priority,
    packingDate: a.packingDate,
    remarks: a.remarks,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    createdBy: a.createdBy,
    record: a.workItem ? toRecord(a.workItem, imageOf) : undefined,
  };
}

async function loadRecord(id: string) {
  const item = await prisma.departmentWorkItem.findFirst({ where: { id, ...dept } });
  if (!item) throw new WorkRequestError('Inventory record not found.', 404);
  return item;
}

/** Shared idempotency: a retried submission returns the first result instead of acting twice. */
async function once<T>(endpoint: string, userId: string, rawKey: unknown, run: (key: string | null) => Promise<T>, replay: (body: any) => Promise<T | null>) {
  const key = typeof rawKey === 'string' && rawKey.trim() ? `${endpoint}:${userId}:${rawKey.trim().slice(0, 128)}` : null;
  const earlier = async () => {
    if (!key) return null;
    const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
    return record && record.endpoint === endpoint ? replay(JSON.parse(record.responseBody)) : null;
  };
  const first = await earlier();
  if (first) return first;
  try {
    return await run(key);
  } catch (error) {
    const won = await earlier().catch(() => null);
    if (won) return won;
    throw error;
  }
}

async function nextPackingNumber() {
  const year = new Date().getFullYear();
  const latest = await prisma.packingAllocation.findFirst({
    where: { packingNumber: { startsWith: `PKG-${year}-` } },
    orderBy: { packingNumber: 'desc' },
    select: { packingNumber: true },
  });
  const seq = (parseInt(latest?.packingNumber.split('-').pop() || '0', 10) || 0) + 1;
  return `PKG-${year}-${String(seq).padStart(4, '0')}`;
}

const allocationInclude = { createdBy: { select: USER_SELECT }, workItem: { include: RECORD_INCLUDE } };

const shared = workflowHandlers(cfg);

/** A Final QC -> Inventory challan as Inventory sees it: garment lines in pieces, no fabric fields. */
function challanView(c: any, imageOf: ImageMap) {
  return {
    id: c.id,
    challanNumber: c.challanNumber,
    challanType: c.challanType,
    status: c.status,
    priority: c.priority,
    fromDepartment: c.fromDepartment,
    toDepartment: c.toDepartment,
    issuedDate: c.issuedDate,
    createdAt: c.createdAt,
    receivedDate: c.receivedDate,
    remarks: c.remarks,
    programId: c.programId,
    program: c.program,
    issuedBy: c.issuedBy,
    receivedBy: c.receivedBy,
    events: c.events,
    lines: (c.workItemsInbound || []).map((w: any) => ({
      id: w.id,
      itemNumber: w.itemNumber,
      status: w.status,
      inventoryStatus: inventoryStatus(w),
      garmentCategory: w.garmentCategory,
      styleRef: w.styleRef,
      colour: w.colour,
      garment: garmentLabel(w),
      uom: w.uom,
      dispatchedQuantity: w.expectedQuantity,
      receivedQuantity: w.status === 'AWAITING_RECEIPT' ? null : w.receivedQuantity ?? w.expectedQuantity,
      receiptRemarks: w.receiptRemarks,
      receivedAt: w.receivedAt,
      image: imageOf({ programId: c.programId, garmentCategory: w.garmentCategory, styleRef: w.styleRef }),
    })),
  };
}

/** Wraps a shared challan list: same filters and permissions, Inventory's view of each challan. */
async function asInventoryChallans(response: Response) {
  if (!response.ok) return response;
  try {
    const body = await response.json();
    const rows: any[] = body.data || [];
    const imageOf = await imagesFor(rows.map((c) => c.programId));
    return NextResponse.json({ data: rows.map((c) => challanView(c, imageOf)) });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load challans.');
  }
}

/** GET challans?view=pending|received|all&search= — Final QC challans to Inventory. */
export const listIncoming = async (request: Request) => asInventoryChallans(await shared.listChallans(request));

/** GET history?view=incoming&... — every challan received into Inventory (shared filters). */
export const challanHistory = async (request: Request) => {
  const url = new URL(request.url);
  url.searchParams.set('view', 'incoming');
  const response = await shared.history(new Request(url, { headers: request.headers }));
  if (!response.ok) return response;
  // History rows carry their lines as workItemsInbound only partly; load the full lines.
  try {
    const body = await response.json();
    const ids = (body.data || []).map((c: any) => c.id);
    const lines = await prisma.departmentWorkItem.findMany({ where: { ...dept, inboundChallanId: { in: ids } }, orderBy: { itemNumber: 'asc' } });
    const byChallan = new Map<string, any[]>();
    for (const l of lines) byChallan.set(l.inboundChallanId, [...(byChallan.get(l.inboundChallanId) || []), l]);
    const rows = (body.data || []).map((c: any) => ({ ...c, workItemsInbound: byChallan.get(c.id) || [] }));
    const imageOf = await imagesFor(rows.map((c: any) => c.programId));
    return NextResponse.json({ data: rows.map((c: any) => challanView(c, imageOf)) });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load challan history.');
  }
};

/** POST challans/:id/receive — the shared receipt (whole pieces, never above the dispatched quantity, posted to the ledger). */
export const receiveChallan = (request: Request, id: string) => shared.receiveChallan(request, id);

/** GET items?search=&category=&status=&from=&to=&sort=&page=&pageSize= — received finished garments. */
export const listRecords = (request: Request) =>
  guarded(request, cfg, async () => {
    await syncWorkItems(cfg);
    const p = new URL(request.url).searchParams;
    const { page, pageSize } = pageParams(p);
    const and: any[] = [dept, { status: { not: 'AWAITING_RECEIPT' } }];
    const search = p.get('search')?.trim();
    if (search) {
      const ci = { contains: search, mode: 'insensitive' as const };
      and.push({
        OR: [
          { itemNumber: ci },
          { styleRef: ci },
          { colour: ci },
          { inboundChallan: { challanNumber: ci } },
          { program: { OR: [{ programNumber: ci }, { programSerialNo: ci }, { designNumber: ci }, { wilcomDesignNumber: ci }] } },
        ],
      });
    }
    const category = p.get('category')?.toUpperCase();
    if (category) and.push({ garmentCategory: category });
    const range = dateRange(p);
    if (range) and.push({ receivedAt: range });
    const rows = await prisma.departmentWorkItem.findMany({ where: { AND: and }, include: RECORD_INCLUDE, orderBy: { receivedAt: 'desc' }, take: MAX_ROWS });

    const imageOf = await imagesFor(rows.map((r) => r.programId));
    let records = rows.map((r) => toRecord(r, imageOf));
    const status = p.get('status');
    if (status === 'OPEN') records = records.filter((r) => r.stock.remaining > 0);
    else if (status === 'AVAILABLE') records = records.filter((r) => r.stock.available > 0);
    else if (status) records = records.filter((r) => r.status === status);
    const sort = p.get('sort') || 'received_desc';
    const by: Record<string, (a: any, b: any) => number> = {
      received_asc: (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
      design: (a, b) => String(a.program?.designNumber || '').localeCompare(String(b.program?.designNumber || '')),
      available: (a, b) => b.stock.available - a.stock.available,
      remaining: (a, b) => b.stock.remaining - a.stock.remaining,
    };
    if (by[sort]) records.sort(by[sort]);
    const total = records.length;
    return NextResponse.json({ data: records.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize });
  }, 'Failed to load the finished garment inventory.');

/** GET items/:id — one record with its packing allocations, transactions and source documents. */
export const getRecord = (request: Request, id: string) =>
  guarded(request, cfg, async () => {
    const item = await prisma.departmentWorkItem.findFirst({ where: { id, ...dept }, include: RECORD_INCLUDE });
    if (!item) throw new WorkRequestError('Inventory record not found.', 404);
    const [allocations, ledger, imageOf] = await Promise.all([
      prisma.packingAllocation.findMany({ where: { workItemId: id }, include: { createdBy: { select: USER_SELECT } }, orderBy: { createdAt: 'desc' } }),
      prisma.stockLedgerEntry.findMany({ where: { departmentCode: cfg.code, itemCode: item.itemNumber }, include: { actor: { select: USER_SELECT } }, orderBy: { createdAt: 'desc' } }),
      imagesFor([item.programId]),
    ]);
    return NextResponse.json({
      data: {
        ...toRecord(item, imageOf),
        allocations: allocations.map((a) => allocationView(a, imageOf)),
        transactions: ledger,
      },
    });
  }, 'Failed to load the inventory record.');

/** GET packing?status=&search=&category=&from=&to=&page=&pageSize= — packing allocations. */
export const listPacking = (request: Request) =>
  guarded(request, cfg, async () => {
    const p = new URL(request.url).searchParams;
    const { page, pageSize } = pageParams(p);
    const and: any[] = [{ workItem: dept }];
    const search = p.get('search')?.trim();
    if (search) {
      const ci = { contains: search, mode: 'insensitive' as const };
      and.push({
        OR: [
          { packingNumber: ci },
          { workItem: { OR: [{ itemNumber: ci }, { styleRef: ci }, { colour: ci }, { inboundChallan: { challanNumber: ci } }] } },
          { workItem: { program: { OR: [{ programNumber: ci }, { programSerialNo: ci }, { designNumber: ci }] } } },
        ],
      });
    }
    const category = p.get('category')?.toUpperCase();
    if (category) and.push({ workItem: { garmentCategory: category } });
    const range = dateRange(p);
    if (range) and.push({ packingDate: range });
    const rows = await prisma.packingAllocation.findMany({ where: { AND: and }, include: allocationInclude, orderBy: { createdAt: 'desc' }, take: MAX_ROWS });
    const imageOf = await imagesFor(rows.map((r) => r.workItem.programId));
    let data = rows.map((r) => allocationView(r, imageOf));
    const status = p.get('status');
    if (status === 'OPEN') data = data.filter((a) => a.open > 0);
    else if (status) data = data.filter((a) => a.status === status);
    const total = data.length;
    return NextResponse.json({ data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize });
  }, 'Failed to load packing work.');

const SEND_ENDPOINT = 'INVENTORY_SEND_FOR_PACKING';
const loadAllocation = (id: string) => prisma.packingAllocation.findUnique({ where: { id }, include: allocationInclude });
const allocationResponse = async (id: string, status: number, replayed = false) => {
  const a = await loadAllocation(id);
  if (!a) return null;
  const imageOf = await imagesFor([a.workItem.programId]);
  return NextResponse.json({ data: allocationView(a, imageOf), ...(replayed ? { replayed } : {}) }, { status });
};

/** POST packing { idempotencyKey, workItemId, quantity, packingDate, priority?, remarks? } — Send for Packing. */
export const sendForPacking = (request: Request) =>
  guarded(request, cfg, async (user) => {
    const body = await request.json().catch(() => null);
    if (!body) throw new WorkRequestError('Invalid request.');
    return once(
      SEND_ENDPOINT,
      user.id,
      body.idempotencyKey,
      async (key) => {
        const item = await loadRecord(String(body.workItemId || ''));
        const check = validateSendForPacking(item, body);
        if (!check.ok) throw new WorkRequestError(check.error);
        const remarks = textOf(body.remarks);
        const after = { ...item, takenQuantity: item.takenQuantity + check.quantity };
        for (let attempt = 0; ; attempt++) {
          const packingNumber = await nextPackingNumber();
          try {
            const id = await prisma.$transaction(async (tx) => {
              // The guard on the sent and packed totals means two people can never send the same pieces.
              const res = await tx.departmentWorkItem.updateMany({
                where: { id: item.id, takenQuantity: item.takenQuantity, processedQuantity: item.processedQuantity },
                data: { takenQuantity: after.takenQuantity, status: workStatusOf(after), startedAt: item.startedAt ?? new Date() },
              });
              if (res.count !== 1) throw new WorkRequestError(`${garmentLabel(item)} changed just now. Refresh and try again.`, 409);
              const allocation = await tx.packingAllocation.create({
                data: {
                  packingNumber,
                  workItemId: item.id,
                  quantity: check.quantity,
                  status: 'SENT_FOR_PACKING',
                  priority: check.priority,
                  packingDate: check.packingDate,
                  remarks,
                  createdById: user.id,
                },
              });
              await tx.stockLedgerEntry.create({
                data: {
                  entryType: LEDGER.SENT_FOR_PACKING,
                  departmentCode: cfg.code,
                  itemCode: item.itemNumber,
                  itemName: garmentLabel(item),
                  colour: item.colour,
                  quantity: -check.quantity,
                  uom: INVENTORY_UNIT,
                  referenceType: 'PACKING',
                  referenceId: allocation.id,
                  programId: item.programId,
                  actorId: user.id,
                  balanceAfter: stockOf(after).available,
                  notes: [`${packingNumber}: ${check.quantity} PCS sent for packing`, remarks].filter(Boolean).join(' · '),
                },
              });
              await tx.auditLog.create({
                data: {
                  actorId: user.id,
                  action: SEND_ENDPOINT,
                  entity: 'PackingAllocation',
                  entityId: allocation.id,
                  afterState: JSON.stringify({ packingNumber, record: item.itemNumber, quantity: check.quantity, priority: check.priority, packingDate: check.packingDate }),
                },
              });
              if (key) {
                await tx.idempotencyRecord.create({ data: { key, endpoint: SEND_ENDPOINT, method: 'POST', statusCode: 201, responseBody: JSON.stringify({ allocationId: allocation.id }) } });
              }
              return allocation.id;
            }, TX);
            return (await allocationResponse(id, 201))!;
          } catch (error) {
            const code = (error as { code?: string; meta?: { target?: unknown } } | null)?.code;
            // Two references issued at the same moment: take the next number.
            if (code === 'P2002' && String((error as any).meta?.target || '').includes('packingNumber') && attempt < 3) continue;
            throw error;
          }
        }
      },
      (b) => allocationResponse(b.allocationId, 200, true),
    );
  }, 'Failed to send the garments for packing.');

const ACTION_ENDPOINT = 'INVENTORY_PACKING_UPDATE';

/**
 * POST packing/:id { idempotencyKey, action: START | PACK | RETURN, quantity?, remarks? }
 * START marks packing as begun; PACK records packed pieces; RETURN sends unpacked pieces back to inventory.
 */
export const updatePacking = (request: Request, id: string) =>
  guarded(request, cfg, async (user) => {
    const body = await request.json().catch(() => null);
    if (!body) throw new WorkRequestError('Invalid request.');
    const action = String(body.action || '').toUpperCase();
    if (!['START', 'PACK', 'RETURN'].includes(action)) throw new WorkRequestError('Unknown packing action.');
    return once(
      `${ACTION_ENDPOINT}_${action}`,
      user.id,
      body.idempotencyKey,
      async (key) => {
        const a = await prisma.packingAllocation.findUnique({ where: { id } });
        if (!a) throw new WorkRequestError('Packing reference not found.', 404);
        const item = await loadRecord(a.workItemId);
        const remarks = textOf(body.remarks);
        const now = new Date();
        let quantity = 0;
        let allocationData: any;
        let itemAfter = item;
        let entryType: string;
        if (action === 'START') {
          if (allocationStatus(a) !== 'SENT_FOR_PACKING') throw new WorkRequestError(`${a.packingNumber} is already ${allocationStatus(a).replace(/_/g, ' ').toLowerCase()}.`, 409);
          allocationData = { startedAt: now, status: 'PACKING_IN_PROGRESS' };
          entryType = LEDGER.PACKING_STARTED;
        } else if (action === 'PACK') {
          const check = validatePacked(a, body);
          if (!check.ok) throw new WorkRequestError(check.error);
          quantity = check.quantity;
          const after = { ...a, packedQuantity: a.packedQuantity + quantity, startedAt: a.startedAt ?? now };
          allocationData = {
            packedQuantity: after.packedQuantity,
            startedAt: after.startedAt,
            status: allocationStatus(after),
            completedAt: allocationStatus(after) === 'PACKING_COMPLETED' ? now : null,
          };
          itemAfter = { ...item, processedQuantity: item.processedQuantity + quantity };
          entryType = LEDGER.PACKED;
        } else {
          const check = validateReturn(a, body);
          if (!check.ok) throw new WorkRequestError(check.error);
          quantity = check.quantity;
          const after = { ...a, returnedQuantity: a.returnedQuantity + quantity };
          allocationData = {
            returnedQuantity: after.returnedQuantity,
            status: allocationStatus(after),
            completedAt: ['PACKING_COMPLETED', 'CANCELLED'].includes(allocationStatus(after)) ? now : null,
          };
          itemAfter = { ...item, takenQuantity: item.takenQuantity - quantity };
          entryType = LEDGER.RETURNED_FROM_PACKING;
        }
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.packingAllocation.updateMany({
            where: { id: a.id, packedQuantity: a.packedQuantity, returnedQuantity: a.returnedQuantity, startedAt: a.startedAt },
            data: allocationData,
          });
          if (claimed.count !== 1) throw new WorkRequestError(`${a.packingNumber} was updated by someone else just now. Refresh and try again.`, 409);
          if (itemAfter !== item) {
            const workStatus = workStatusOf(itemAfter);
            const res = await tx.departmentWorkItem.updateMany({
              where: { id: item.id, takenQuantity: item.takenQuantity, processedQuantity: item.processedQuantity },
              data: {
                takenQuantity: itemAfter.takenQuantity,
                processedQuantity: itemAfter.processedQuantity,
                status: workStatus,
                completedAt: workStatus === 'COMPLETED' ? item.completedAt ?? now : null,
              },
            });
            if (res.count !== 1) throw new WorkRequestError(`${garmentLabel(item)} changed just now. Refresh and try again.`, 409);
          }
          await tx.stockLedgerEntry.create({
            data: {
              entryType,
              departmentCode: cfg.code,
              itemCode: item.itemNumber,
              itemName: garmentLabel(item),
              colour: item.colour,
              quantity: action === 'RETURN' ? quantity : action === 'PACK' ? quantity : 0,
              uom: INVENTORY_UNIT,
              referenceType: 'PACKING',
              referenceId: a.id,
              programId: item.programId,
              actorId: user.id,
              balanceAfter: stockOf(itemAfter).available,
              notes: [
                action === 'START' ? `${a.packingNumber}: packing started` : action === 'PACK' ? `${a.packingNumber}: ${quantity} PCS packed` : `${a.packingNumber}: ${quantity} PCS returned unpacked`,
                remarks,
              ].filter(Boolean).join(' · '),
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: `${ACTION_ENDPOINT}_${action}`,
              entity: 'PackingAllocation',
              entityId: a.id,
              beforeState: JSON.stringify({ packed: a.packedQuantity, returned: a.returnedQuantity, status: allocationStatus(a) }),
              afterState: JSON.stringify({ ...allocationData, quantity, remarks }),
            },
          });
          if (key) {
            await tx.idempotencyRecord.create({ data: { key, endpoint: `${ACTION_ENDPOINT}_${action}`, method: 'POST', statusCode: 200, responseBody: JSON.stringify({ allocationId: a.id }) } });
          }
        }, TX);
        return (await allocationResponse(a.id, 200))!;
      },
      (b) => allocationResponse(b.allocationId, 200, true),
    );
  }, 'Failed to update packing.');

/** GET dashboard — every figure from records, allocations and the ledger. */
export const dashboard = (request: Request) =>
  guarded(request, cfg, async () => {
    await syncWorkItems(cfg);
    const [items, allocations, pendingChallans, receipts, packingEntries, alerts] = await Promise.all([
      prisma.departmentWorkItem.findMany({ where: dept, include: RECORD_INCLUDE }),
      prisma.packingAllocation.findMany({ where: { workItem: dept }, include: allocationInclude, orderBy: { packingDate: 'asc' } }),
      prisma.challan.count({ where: { toDepartment: cfg.code, workItemsInbound: { some: { ...dept, status: 'AWAITING_RECEIPT' } } } }),
      prisma.stockLedgerEntry.findMany({ where: { departmentCode: cfg.code, entryType: LEDGER.RECEIPT }, include: { actor: { select: USER_SELECT } }, orderBy: { createdAt: 'desc' }, take: 8 }),
      prisma.stockLedgerEntry.findMany({
        where: { departmentCode: cfg.code, entryType: { in: [LEDGER.SENT_FOR_PACKING, LEDGER.PACKING_STARTED, LEDGER.PACKED, LEDGER.RETURNED_FROM_PACKING] } },
        include: { actor: { select: USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.deadlineAlert.count({ where: { departmentCode: cfg.code, status: 'ACTIVE' } }).catch(() => 0),
    ]);
    const imageOf = await imagesFor(items.map((i) => i.programId));
    const sum = (list: number[]) => list.reduce((s, q) => s + q, 0);
    const held = items.filter((i) => i.status !== 'AWAITING_RECEIPT');
    const stocks = held.map((i) => stockOf(i));
    const views = allocations.map((a) => allocationView(a, imageOf));
    const open = views.filter((a) => a.open > 0);
    const now = Date.now();
    const overdue = held.filter((i) => stockOf(i).remaining > 0 && i.program?.deliveryDate && new Date(i.program.deliveryDate).getTime() < now);
    return NextResponse.json({
      data: {
        totals: {
          received: sum(stocks.map((s) => s.received)),
          available: sum(stocks.map((s) => s.available)),
          sentForPacking: sum(open.filter((a) => a.status === 'SENT_FOR_PACKING').map((a) => a.open)),
          beingPacked: sum(open.filter((a) => a.status !== 'SENT_FOR_PACKING').map((a) => a.open)),
          packed: sum(stocks.map((s) => s.packed)),
          remaining: sum(stocks.map((s) => s.remaining)),
          awaitingReceipt: sum(items.filter((i) => i.status === 'AWAITING_RECEIPT').map((i) => i.expectedQuantity)),
        },
        counts: {
          pendingChallans,
          records: held.length,
          readyRecords: held.filter((i) => stockOf(i).available > 0).length,
          partiallyPackedRecords: held.filter((i) => inventoryStatus(i) === 'PARTIAL').length,
          partiallyPackedAllocations: open.filter((a) => a.status === 'PARTIALLY_PACKED').length,
          packedRecords: held.filter((i) => inventoryStatus(i) === 'PACKED').length,
          openAllocations: open.length,
          overdue: overdue.length,
          deadlineAlerts: alerts,
        },
        pendingPacking: open.slice(0, 10),
        readyToSend: held
          .filter((i) => stockOf(i).available > 0)
          .map((i) => toRecord(i, imageOf))
          .sort((a, b) => new Date(a.program?.deliveryDate || 8.64e15).getTime() - new Date(b.program?.deliveryDate || 8.64e15).getTime())
          .slice(0, 10),
        recentReceipts: receipts,
        recentPacking: packingEntries,
      },
    });
  }, 'Failed to load the Inventory dashboard.');

/** GET transactions?type=&search=&from=&to=&page=&pageSize= — the inventory ledger (and the earlier Packing module's). */
export const transactions = (request: Request) =>
  guarded(request, cfg, async () => {
    const p = new URL(request.url).searchParams;
    const { page, pageSize } = pageParams(p);
    const and: any[] = [{ departmentCode: { in: [cfg.code, LEGACY_LEDGER_DEPARTMENT] } }];
    if (p.get('type')) and.push({ entryType: p.get('type') });
    const search = p.get('search')?.trim();
    if (search) {
      const ci = { contains: search, mode: 'insensitive' as const };
      and.push({ OR: [{ itemCode: ci }, { itemName: ci }, { notes: ci }, { program: { OR: [{ programSerialNo: ci }, { programNumber: ci }, { designNumber: ci }] } }] });
    }
    const range = dateRange(p);
    if (range) and.push({ createdAt: range });
    const where = { AND: and };
    const [total, rows] = await Promise.all([
      prisma.stockLedgerEntry.count({ where }),
      prisma.stockLedgerEntry.findMany({
        where,
        include: { actor: { select: USER_SELECT }, program: { select: PROGRAM_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    // Name the challan or packing reference each entry belongs to.
    const ids = (type: string) => rows.filter((r) => r.referenceType === type && r.referenceId).map((r) => r.referenceId as string);
    const [challans, packs] = await Promise.all([
      prisma.challan.findMany({ where: { id: { in: ids('CHALLAN') } }, select: { id: true, challanNumber: true } }),
      prisma.packingAllocation.findMany({ where: { id: { in: ids('PACKING') } }, select: { id: true, packingNumber: true } }),
    ]);
    const names = new Map<string, string>([...challans.map((c) => [c.id, c.challanNumber] as const), ...packs.map((a) => [a.id, a.packingNumber] as const)]);
    return NextResponse.json({
      data: rows.map((r) => ({ ...r, reference: r.referenceId ? names.get(r.referenceId) || null : null, legacy: r.departmentCode === LEGACY_LEDGER_DEPARTMENT })),
      total,
      page,
      pageSize,
    });
  }, 'Failed to load inventory transactions.');

/**
 * POST garment-images (multipart: programId, garmentCategory, styleRef?, file) — upload or replace the
 * complete-garment image of a design and category (optionally one style). Only for garments held in Inventory.
 */
export const uploadGarmentImage = (request: Request) =>
  guarded(request, cfg, async (user) => {
    const fields = await readGarmentImageForm(request);
    const { programId, garmentCategory, styleRef } = fields;
    const held = await prisma.departmentWorkItem.findFirst({
      where: { ...dept, programId, garmentCategory: garmentCategory || null, ...(styleRef ? { styleRef } : {}) },
      select: { id: true, itemNumber: true, program: { select: { programSerialNo: true, programNumber: true } } },
    });
    if (!held) throw new WorkRequestError('No garments of this design and category are held in Inventory.', 404);
    const image = await storeGarmentImage(user, fields, { action: 'INVENTORY_GARMENT_IMAGE', department: cfg.code }, async (tx, saved, replaced, fileName) => {
      const sheet = held.program?.programSerialNo || held.program?.programNumber || '';
      await tx.stockLedgerEntry.create({
        data: {
          entryType: LEDGER.IMAGE_UPLOADED,
          departmentCode: cfg.code,
          itemCode: held.itemNumber,
          itemName: [sheet, garmentCategory || 'Garment', styleRef].filter(Boolean).join(' · '),
          quantity: 0,
          uom: INVENTORY_UNIT,
          referenceType: 'GARMENT_IMAGE',
          referenceId: saved.id,
          programId,
          actorId: user.id,
          balanceAfter: 0,
          notes: `${replaced ? 'Garment image replaced' : 'Garment image uploaded'}: ${fileName}`,
        },
      });
    });
    return NextResponse.json({ data: image }, { status: 201 });
  }, 'Failed to save the garment image.');

/** GET garment-images/:id — the image itself (shared with every department, lib/garment-images-server). */
export { serveGarmentImage };
