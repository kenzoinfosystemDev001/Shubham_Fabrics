import { createHash, randomUUID } from 'node:crypto';
import { prisma, type Prisma, type PrismaClient } from '@subham/database';
import { factoryDay } from '@/lib/deadline-alerts/rules.mjs';
import { cleanFabricName, fabricNameKey } from '@/lib/fabric-stock-rules.mjs';
import {
  STOCK_TRANSACTION_OPTIONS,
  loadStockBook,
  lockFabricStock,
  postNewInwardRows,
} from '@/lib/fabric-stock-ledger';
import { cleanText, suggestMapping, validateMapping } from './columns.mjs';
import {
  EDITABLE_STATES,
  assertTransition,
  canonicalPostingPayload,
  invoiceKeyOf,
  normalizeRow,
  stateAfterValidation,
  validateImportRows,
} from './rows.mjs';
import { canApproveStockInward } from './permissions.mjs';
import { IMPORT_LIMITS, WorkbookRejectedError, inspectWorkbookBytes, safeFileName } from './workbook-guard.mjs';
import { readWorkbook, type StoredSheet } from './workbook';

/**
 * Excel stock inward imports. The uploaded workbook is stored as evidence and read once; mapping,
 * corrections and fabric resolutions are kept on the import, and validation is recomputed from
 * them against the current store. Stock changes only in confirmImport(), which posts every row in
 * one transaction through the Fabric Store stock ledger.
 */

type Db = PrismaClient | Prisma.TransactionClient;
type Actor = { id: string; isAdmin: boolean; roles: string[] };

const TIME_ZONE = 'Asia/Kolkata';

/** Request failure with an HTTP status and a message for the Fabric Store user. */
export class StockImportError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly details?: unknown) {
    super(message);
    this.name = 'StockImportError';
  }
}

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

type Corrections = Record<string, Record<string, string>>;
type Resolutions = Record<string, { action: 'MAP'; target: string } | { action: 'ACCEPT_NEW'; by: string }>;

function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

const importSelect = {
  id: true,
  status: true,
  fileName: true,
  fileHash: true,
  fileSize: true,
  sheetsJson: true,
  selectedSheet: true,
  headerRow: true,
  mappingJson: true,
  correctionsJson: true,
  resolutionsJson: true,
  validationJson: true,
  payloadHash: true,
  receiptNumber: true,
  confirmKey: true,
  postedAt: true,
  postedResultJson: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, fullName: true, username: true } },
  postedBy: { select: { id: true, fullName: true, username: true } },
  documents: { select: { id: true, kind: true, sheetName: true, mimeType: true, size: true, ocrStatus: true } },
} satisfies Prisma.FabricStockImportSelect;

type ImportRecord = Prisma.FabricStockImportGetPayload<{ select: typeof importSelect }>;

async function loadImport(db: Db, id: string): Promise<ImportRecord> {
  const record = await db.fabricStockImport.findUnique({ where: { id }, select: importSelect });
  if (!record) throw new StockImportError('Import not found.', 404, 'NOT_FOUND');
  return record;
}

function requireEditable(record: { status: string }) {
  if (!(EDITABLE_STATES as readonly string[]).includes(record.status)) {
    throw new StockImportError(
      record.status === 'POSTED'
        ? 'This import is already posted. Posted stock is corrected through Inward Stock edits, not by changing the import.'
        : `This import is ${record.status.toLowerCase().replace(/_/g, ' ')} and can no longer be changed.`,
      409,
      'NOT_EDITABLE',
    );
  }
}

/** What the store already holds that a new import is checked against. */
async function loadContext(db: Db, importId: string, fileHash: string) {
  const [inwards, postedSameFile] = await Promise.all([
    db.fabricInward.findMany({ select: { itemName: true, supplierName: true, billNo: true, rollKey: true } }),
    db.fabricStockImport.findFirst({
      where: { fileHash, status: 'POSTED', NOT: { id: importId } },
      select: { receiptNumber: true },
    }),
  ]);
  const knownFabrics = new Map<string, string>();
  const existingRollKeys = new Set<string>();
  const existingInvoiceKeys = new Set<string>();
  for (const inward of inwards) {
    const key = fabricNameKey(inward.itemName);
    if (key && !knownFabrics.has(key)) knownFabrics.set(key, cleanFabricName(inward.itemName) || inward.itemName.trim());
    if (inward.rollKey) existingRollKeys.add(inward.rollKey);
    const invoiceKey = invoiceKeyOf(inward.supplierName, inward.billNo);
    if (invoiceKey) existingInvoiceKeys.add(invoiceKey);
  }
  return {
    knownFabrics,
    existingRollKeys,
    existingInvoiceKeys,
    postedSameFile: postedSameFile?.receiptNumber ? { receiptNumber: postedSameFile.receiptNumber } : null,
    today: factoryDay(new Date(), TIME_ZONE),
  };
}

function sheetOf(record: { sheetsJson: string; selectedSheet: string | null }): StoredSheet | null {
  const sheets = parseJson<StoredSheet[]>(record.sheetsJson, []);
  return sheets.find((s) => s.name === record.selectedSheet) || null;
}

/** Recomputes the row results for an import from its stored sheet, mapping and corrections. */
async function computeValidation(db: Db, record: ImportRecord) {
  const sheet = sheetOf(record);
  const mapping = parseJson<Record<string, number>>(record.mappingJson, {});
  if (!sheet || !record.headerRow || Object.keys(mapping).length === 0) return null;
  const corrections = parseJson<Corrections>(record.correctionsJson, {});
  const resolutions = parseJson<Resolutions>(record.resolutionsJson, {});
  const dataRows = sheet.rows.filter((r) => r.rowNumber > record.headerRow!);
  const normalized = dataRows.map((row) => normalizeRow(row, mapping, corrections[String(row.rowNumber)] || {}));
  const context = await loadContext(db, record.id, record.fileHash);
  const result = validateImportRows(normalized, context, resolutions);
  const payloadHash = sha256(canonicalPostingPayload(result.rows));
  return { ...result, payloadHash, knownFabricNames: Array.from(context.knownFabrics.values()).sort() };
}

async function revalidate(db: Db, id: string) {
  const record = await loadImport(db, id);
  const validation = await computeValidation(db, record);
  if (!validation) return loadImport(db, id);
  const next = stateAfterValidation(validation.summary);
  assertTransition(record.status, next);
  await db.fabricStockImport.update({
    where: { id },
    data: { status: next, validationJson: JSON.stringify(validation), payloadHash: validation.payloadHash },
  });
  return loadImport(db, id);
}

/** Import as returned to the browser (no file bytes; sheet grids reduced to what the wizard needs). */
export function presentImport(record: ImportRecord, viewer?: Actor) {
  const sheets = parseJson<StoredSheet[]>(record.sheetsJson, []);
  const selected = sheets.find((s) => s.name === record.selectedSheet) || null;
  const headerCells = selected && record.headerRow ? selected.rows.find((r) => r.rowNumber === record.headerRow)?.cells || [] : [];
  return {
    id: record.id,
    status: record.status,
    fileName: record.fileName,
    fileSize: record.fileSize,
    fileHash: record.fileHash,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    uploadedBy: record.uploadedBy,
    postedBy: record.postedBy,
    postedAt: record.postedAt,
    receiptNumber: record.receiptNumber,
    failureReason: record.failureReason,
    documents: record.documents,
    sheets: sheets.map((s) => ({
      name: s.name,
      hidden: s.hidden,
      rowCount: s.rowCount,
      columnCount: s.columnCount,
      detectedHeaderRow: s.detectedHeaderRow,
      imageCount: s.imageCount,
      preview: s.rows.slice(0, 20),
    })),
    selectedSheet: record.selectedSheet,
    headerRow: record.headerRow,
    headers: headerCells.map((c) => (c === null || typeof c === 'object' ? '' : cleanText(c))),
    suggestion: headerCells.length ? suggestMapping(headerCells) : null,
    mapping: parseJson<Record<string, number>>(record.mappingJson, {}),
    corrections: parseJson<Corrections>(record.correctionsJson, {}),
    resolutions: parseJson<Resolutions>(record.resolutionsJson, {}),
    validation: parseJson<any>(record.validationJson, null),
    payloadHash: record.payloadHash,
    result: parseJson<any>(record.postedResultJson, null),
    permissions: viewer ? { canApprove: canApproveStockInward(viewer) } : undefined,
  };
}

async function audit(db: Db, actorId: string, action: string, entityId: string, after: unknown) {
  await db.auditLog.create({
    data: { actorId, action, entity: 'FabricStockImport', entityId, afterState: JSON.stringify(after).slice(0, 20000) },
  });
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Stores an uploaded workbook, reads it and, when the columns are unambiguous, validates it. */
export async function createImport(file: { name: string; bytes: Buffer }, actor: Actor) {
  try {
    inspectWorkbookBytes(file.bytes);
  } catch (error) {
    if (error instanceof WorkbookRejectedError) throw new StockImportError(error.message, 400, error.code);
    throw error;
  }
  const fileHash = sha256(file.bytes);
  const fileName = safeFileName(file.name);

  let sheets: StoredSheet[];
  let images: Awaited<ReturnType<typeof readWorkbook>>['images'];
  try {
    ({ sheets, images } = await readWorkbook(file.bytes));
  } catch (error) {
    if (!(error instanceof WorkbookRejectedError)) throw error;
    // Keep a FAILED record so the attempt shows in the import history.
    const failed = await prisma.fabricStockImport.create({
      data: { status: 'FAILED', fileName, fileHash, fileSize: file.bytes.length, fileData: new Uint8Array(file.bytes), sheetsJson: '[]', failureReason: error.message, uploadedById: actor.id },
      select: { id: true },
    });
    await audit(prisma, actor.id, 'FABRIC_STOCK_IMPORT_FAILED', failed.id, { fileName, fileHash, reason: error.code });
    throw new StockImportError(error.message, 400, error.code, { importId: failed.id });
  }

  const usable = sheets.filter((s) => s.rowCount > 0);
  if (usable.length === 0) throw new StockImportError('Every worksheet in this workbook is empty.', 400, 'EMPTY');
  const auto = usable.filter((s) => s.detectedHeaderRow).length === 1 ? usable.find((s) => s.detectedHeaderRow)! : null;

  const created = await prisma.fabricStockImport.create({
    data: {
      status: 'PARSED',
      fileName,
      fileHash,
      fileSize: file.bytes.length,
      fileData: new Uint8Array(file.bytes),
      sheetsJson: JSON.stringify(sheets),
      selectedSheet: auto?.name ?? (usable.length === 1 ? usable[0].name : null),
      headerRow: auto?.detectedHeaderRow ?? null,
      uploadedById: actor.id,
      documents: {
        create: images.map((image) => ({
          kind: 'EMBEDDED_IMAGE',
          sheetName: image.sheetName,
          mimeType: image.mimeType,
          size: image.data.length,
          sha256: sha256(image.data),
          data: new Uint8Array(image.data),
        })),
      },
    },
    select: { id: true },
  });
  await audit(prisma, actor.id, 'FABRIC_STOCK_IMPORT_UPLOADED', created.id, {
    fileName, fileHash, fileSize: file.bytes.length, sheets: sheets.map((s) => ({ name: s.name, rows: s.rowCount })), images: images.length,
  });

  // A clean, unambiguous header is mapped straight away; anything else waits for the user.
  if (auto?.detectedHeaderRow) {
    const header = auto.rows.find((r) => r.rowNumber === auto.detectedHeaderRow)!;
    const suggestion = suggestMapping(header.cells);
    if (suggestion.ambiguities.length === 0 && suggestion.missingRequired.length === 0) {
      await prisma.fabricStockImport.update({ where: { id: created.id }, data: { mappingJson: JSON.stringify(suggestion.mapping) } });
      return revalidate(prisma, created.id);
    }
  }
  return loadImport(prisma, created.id);
}

/** Sets the worksheet, header row and column mapping chosen by the user, then validates. */
export async function configureImport(id: string, input: { sheetName: unknown; headerRow: unknown; mapping: unknown }, actor: Actor) {
  const record = await loadImport(prisma, id);
  requireEditable(record);
  const sheets = parseJson<StoredSheet[]>(record.sheetsJson, []);
  const sheet = sheets.find((s) => s.name === input.sheetName);
  if (!sheet) throw new StockImportError('Choose a worksheet from this workbook.', 400, 'BAD_SHEET');
  const headerRow = Number(input.headerRow);
  const header = sheet.rows.find((r) => r.rowNumber === headerRow);
  if (!header) throw new StockImportError('The header row must be a filled row of the chosen worksheet.', 400, 'BAD_HEADER_ROW');
  const columnCount = Math.max(sheet.columnCount, header.cells.length);
  const checked = validateMapping(input.mapping as Record<string, number>, columnCount);
  if (!checked.ok) throw new StockImportError(checked.errors.join(' '), 400, 'BAD_MAPPING', { errors: checked.errors });

  const sheetChanged = record.selectedSheet !== sheet.name || record.headerRow !== headerRow;
  await prisma.fabricStockImport.update({
    where: { id },
    data: {
      selectedSheet: sheet.name,
      headerRow,
      mappingJson: JSON.stringify(checked.mapping),
      // Row corrections belong to rows of one sheet layout.
      ...(sheetChanged ? { correctionsJson: null } : {}),
    },
  });
  await audit(prisma, actor.id, 'FABRIC_STOCK_IMPORT_MAPPED', id, { sheet: sheet.name, headerRow, mapping: checked.mapping });
  return revalidate(prisma, id);
}

const CORRECTABLE_FIELDS = new Set([
  'fabricName', 'fabricType', 'colour', 'shade', 'composition', 'width', 'quantity', 'unit', 'rollNumber', 'batchNumber',
  'supplierName', 'billNo', 'billDate', 'receivedDate', 'purchaseOrderNumber', 'unitRate', 'storageLocation', 'remarks',
]);

/** Replaces one cell's value for this import (the file itself is never changed); null removes it. */
export async function correctRow(id: string, input: { rowNumber: unknown; field: unknown; value: unknown }, actor: Actor) {
  const record = await loadImport(prisma, id);
  requireEditable(record);
  const rowNumber = Number(input.rowNumber);
  const field = String(input.field || '');
  if (!CORRECTABLE_FIELDS.has(field)) throw new StockImportError('This field cannot be corrected.', 400, 'BAD_FIELD');
  const sheet = sheetOf(record);
  if (!sheet || !record.headerRow || !sheet.rows.some((r) => r.rowNumber === rowNumber && rowNumber > record.headerRow!)) {
    throw new StockImportError('That row is not part of this import.', 400, 'BAD_ROW');
  }
  const corrections = parseJson<Corrections>(record.correctionsJson, {});
  const key = String(rowNumber);
  if (input.value === null || input.value === undefined) {
    if (corrections[key]) delete corrections[key][field];
    if (corrections[key] && Object.keys(corrections[key]).length === 0) delete corrections[key];
  } else {
    const value = cleanText(input.value).slice(0, 500);
    corrections[key] = { ...(corrections[key] || {}), [field]: value };
  }
  await prisma.fabricStockImport.update({ where: { id }, data: { correctionsJson: JSON.stringify(corrections) } });
  await audit(prisma, actor.id, 'FABRIC_STOCK_IMPORT_ROW_CORRECTED', id, { rowNumber, field, value: input.value ?? null });
  return revalidate(prisma, id);
}

/**
 * Resolves a fabric name never received before: MAP to a fabric already in stock, ACCEPT_NEW as a
 * new fabric (approvers only), or CLEAR the decision.
 */
export async function resolveFabric(id: string, input: { name: unknown; action: unknown; target?: unknown }, actor: Actor) {
  const record = await loadImport(prisma, id);
  requireEditable(record);
  const key = fabricNameKey(String(input.name || ''));
  if (!key) throw new StockImportError('Fabric name is required.', 400, 'BAD_FABRIC');
  const resolutions = parseJson<Resolutions>(record.resolutionsJson, {});
  if (input.action === 'MAP') {
    const target = cleanText(input.target);
    const context = await loadContext(prisma, id, record.fileHash);
    if (!context.knownFabrics.has(fabricNameKey(target))) {
      throw new StockImportError(`"${target}" is not a fabric in Fabric Store stock.`, 400, 'UNKNOWN_TARGET');
    }
    resolutions[key] = { action: 'MAP', target: context.knownFabrics.get(fabricNameKey(target))! };
  } else if (input.action === 'ACCEPT_NEW') {
    if (!canApproveStockInward(actor)) {
      throw new StockImportError('Only a Fabric Store incharge can accept a new fabric name.', 403, 'FORBIDDEN');
    }
    resolutions[key] = { action: 'ACCEPT_NEW', by: actor.id };
  } else if (input.action === 'CLEAR') {
    delete resolutions[key];
  } else {
    throw new StockImportError('Choose MAP, ACCEPT_NEW or CLEAR.', 400, 'BAD_ACTION');
  }
  await prisma.fabricStockImport.update({ where: { id }, data: { resolutionsJson: JSON.stringify(resolutions) } });
  await audit(prisma, actor.id, 'FABRIC_STOCK_IMPORT_FABRIC_RESOLVED', id, { fabric: input.name, action: input.action, target: input.target ?? null });
  return revalidate(prisma, id);
}

/** Re-runs validation against the store as it is now (stock may have changed since upload). */
export async function revalidateImport(id: string) {
  const record = await loadImport(prisma, id);
  requireEditable(record);
  return revalidate(prisma, id);
}

export async function cancelImport(id: string, actor: Actor) {
  const record = await loadImport(prisma, id);
  requireEditable(record);
  assertTransition(record.status, 'CANCELLED');
  const updated = await prisma.fabricStockImport.updateMany({
    where: { id, status: record.status },
    data: { status: 'CANCELLED' },
  });
  if (updated.count === 0) throw new StockImportError('The import changed while cancelling; reload it.', 409, 'CONFLICT');
  await audit(prisma, actor.id, 'FABRIC_STOCK_IMPORT_CANCELLED', id, { from: record.status });
  return loadImport(prisma, id);
}

export interface ConfirmResult {
  receiptNumber: string;
  postedAt: string;
  postedBy: { id: string; name: string };
  rowsPosted: number;
  rollsCreated: number;
  inwardIds: string[];
  ledgerEntryIds: string[];
  totalsByUnit: Record<string, number>;
  totalsByFabric: Array<{ fabric: string; fabricType: string; colour: string | null; unit: string; quantity: number; rows: number; isNew: boolean }>;
  newFabrics: string[];
}

async function nextReceiptNumber(tx: Prisma.TransactionClient, now: Date) {
  const year = factoryDay(now, TIME_ZONE).slice(0, 4);
  const prefix = `FSR-${year}-`;
  const count = await tx.fabricStockImport.count({ where: { receiptNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

function toDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * Posts a ready import: one FabricInward row per worksheet row plus its ledger receipt, all in
 * one transaction under the stock lock. Idempotent: a confirmation of an already posted import
 * with the same previewed payload returns the original result and posts nothing.
 */
export async function confirmImport(
  id: string,
  input: { idempotencyKey: unknown; payloadHash: unknown; acknowledgeWarnings?: unknown },
  actor: Actor,
): Promise<{ result: ConfirmResult; replayed: boolean }> {
  const idempotencyKey = cleanText(input.idempotencyKey).slice(0, 128);
  const payloadHash = cleanText(input.payloadHash);
  if (!idempotencyKey || !payloadHash) throw new StockImportError('idempotencyKey and payloadHash are required.', 400, 'BAD_REQUEST');

  if (!canApproveStockInward(actor)) {
    await audit(prisma, actor.id, 'FABRIC_STOCK_IMPORT_CONFIRM_DENIED', id, { roles: actor.roles });
    throw new StockImportError('Only a Fabric Store incharge can confirm stock inward.', 403, 'FORBIDDEN');
  }

  const replay = (record: ImportRecord) => {
    if (record.payloadHash !== payloadHash) {
      throw new StockImportError('This import was already posted with different rows. Nothing was posted again.', 409, 'PAYLOAD_MISMATCH');
    }
    return { result: parseJson<ConfirmResult>(record.postedResultJson, null as any), replayed: true };
  };

  const before = await loadImport(prisma, id);
  if (before.status === 'POSTED') return replay(before);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockFabricStock(tx);
      const record = await loadImport(tx, id);
      if (record.status === 'POSTED') return replay(record);
      if (record.status !== 'READY_FOR_CONFIRMATION') {
        throw new StockImportError('This import is not ready to post. Fix the rows marked with errors first.', 409, 'NOT_READY');
      }

      // Revalidate against the store as it is inside the lock; the user must have seen exactly this.
      const validation = await computeValidation(tx, record);
      if (!validation || !validation.summary.canConfirm) {
        throw new StockImportError('Stock or the import changed since the preview and some rows are no longer valid. Revalidate and review.', 409, 'STALE_PREVIEW');
      }
      if (validation.payloadHash !== payloadHash || record.payloadHash !== payloadHash) {
        throw new StockImportError('The rows changed since you reviewed them. Revalidate and review before confirming.', 409, 'STALE_PREVIEW');
      }
      if (validation.summary.requiresWarningAcknowledgement && input.acknowledgeWarnings !== true) {
        throw new StockImportError('Acknowledge the warnings before confirming.', 400, 'WARNINGS_NOT_ACKNOWLEDGED');
      }

      const claimed = await tx.fabricStockImport.updateMany({
        where: { id, status: 'READY_FOR_CONFIRMATION' },
        data: { status: 'POSTING' },
      });
      if (claimed.count !== 1) throw new StockImportError('Another confirmation is posting this import.', 409, 'CONFLICT');

      const baseBook = (await loadStockBook(tx)).book;
      const now = new Date();
      const receiptNumber = await nextReceiptNumber(tx, now);
      const postable = validation.rows.filter((r: any) => r.status === 'VALID' || r.status === 'WARNING');
      const inwardRows = postable.map((row: any) => ({
        id: randomUUID(),
        entryType: row.values.fabricType,
        itemName: row.fabric.name,
        colour: row.values.colour,
        billNo: row.values.billNo,
        billDate: toDate(row.values.billDate),
        receivingDate: toDate(row.values.receivedDate),
        billQty: row.values.quantity,
        unit: row.values.unit,
        supplierName: row.values.supplierName,
        remarks: [row.values.remarks, `Import ${receiptNumber} row ${row.rowNumber}`, row.fabric.mappedFrom ? `Listed as "${row.fabric.mappedFrom}"` : null]
          .filter(Boolean)
          .join(' | '),
        rollNumber: row.values.rollNumber,
        rollKey: row.rollKey,
        batchNumber: row.values.batchNumber,
        shade: row.values.shade,
        composition: row.values.composition,
        width: row.values.width,
        unitRate: row.values.unitRate ?? null,
        storageLocation: row.values.storageLocation,
        purchaseOrderNumber: row.values.purchaseOrderNumber,
        importId: id,
        importRowNumber: row.rowNumber,
      }));
      await tx.fabricInward.createMany({ data: inwardRows });
      const ledger = await postNewInwardRows(tx, inwardRows, { actorId: actor.id, baseBook, label: `Stock import ${receiptNumber}` });

      const result: ConfirmResult = {
        receiptNumber,
        postedAt: now.toISOString(),
        postedBy: { id: actor.id, name: '' },
        rowsPosted: inwardRows.length,
        rollsCreated: inwardRows.filter((r) => r.rollKey).length,
        inwardIds: inwardRows.map((r) => r.id),
        ledgerEntryIds: ledger.map((l) => l.id),
        totalsByUnit: validation.summary.byUnit as Record<string, number>,
        totalsByFabric: validation.summary.byFabric,
        newFabrics: validation.summary.newFabrics,
      };
      const poster = await tx.user.findUnique({ where: { id: actor.id }, select: { fullName: true, username: true } });
      result.postedBy.name = poster?.fullName || poster?.username || '';

      assertTransition('POSTING', 'POSTED');
      await tx.fabricStockImport.update({
        where: { id },
        data: {
          status: 'POSTED',
          receiptNumber,
          confirmKey: idempotencyKey,
          postedAt: now,
          postedById: actor.id,
          postedResultJson: JSON.stringify(result),
          validationJson: JSON.stringify(validation),
        },
      });
      await audit(tx, actor.id, 'FABRIC_STOCK_IMPORT_POSTED', id, {
        receiptNumber, fileHash: record.fileHash, rows: result.rowsPosted, totalsByUnit: result.totalsByUnit,
        newFabrics: result.newFabrics, inwardIds: result.inwardIds, ledgerEntryIds: result.ledgerEntryIds,
      });
      return { result, replayed: false };
    }, STOCK_TRANSACTION_OPTIONS);
  } catch (error: any) {
    // A concurrent confirmation that committed first: return its result instead of failing.
    const after = await loadImport(prisma, id).catch(() => null);
    if (after?.status === 'POSTED') return replay(after);
    if (error instanceof StockImportError) throw error;
    if (error?.code === 'P2002') {
      const target = String(error?.meta?.target || '');
      if (target.includes('rollKey')) {
        throw new StockImportError('A roll in this import was received by another import just now. Revalidate and review.', 409, 'ROLL_CONFLICT');
      }
      if (target.includes('confirmKey')) {
        throw new StockImportError('This confirmation key was already used for another import.', 409, 'KEY_REUSED');
      }
    }
    throw error;
  }
}

export async function listImports(page: number, pageSize: number) {
  const take = Math.min(Math.max(pageSize, 1), 50);
  const skip = (Math.max(page, 1) - 1) * take;
  const [rows, total] = await Promise.all([
    prisma.fabricStockImport.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true, status: true, fileName: true, receiptNumber: true, createdAt: true, postedAt: true, failureReason: true,
        validationJson: true, uploadedBy: { select: { fullName: true, username: true } }, postedBy: { select: { fullName: true, username: true } },
      },
    }),
    prisma.fabricStockImport.count(),
  ]);
  return {
    total,
    page: Math.max(page, 1),
    pageSize: take,
    data: rows.map(({ validationJson, ...row }) => {
      const summary = parseJson<any>(validationJson, null)?.summary || null;
      return { ...row, summary: summary && { totalRows: summary.totalRows, errorRows: summary.errorRows, warningRows: summary.warningRows, byUnit: summary.byUnit } };
    }),
  };
}

export async function getImport(id: string) {
  return loadImport(prisma, id);
}

export async function knownFabricNames() {
  const rows = await prisma.fabricInward.findMany({ select: { itemName: true } });
  const names = new Map<string, string>();
  for (const { itemName } of rows) {
    const key = fabricNameKey(itemName);
    if (key && !names.has(key)) names.set(key, cleanFabricName(itemName) || itemName.trim());
  }
  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

export { IMPORT_LIMITS };
