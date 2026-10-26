import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { apiErrorResponse } from '@/lib/api-errors';
import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  lockFabricStock,
  postNewInwardStock,
} from '@/lib/fabric-stock-ledger';
import { inwardDuplicateKey, validateConfirmRows } from '@/lib/stock-import-rules.mjs';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

class ImportConflict extends Error {}

interface ImportResult {
  added: Array<{ rowNo: number; id: string; sNo: number; itemName: string; colour: string | null; billQty: number; unit: string }>;
  skipped: Array<{ rowNo: number; itemName: string; reason: string }>;
  totals: { MTR: number; PCS: number };
}

/**
 * POST /api/fabric-store/inward/import/:id/confirm - adds the reviewed rows to Inward Stock.
 *
 * Body: { confirmKey, entryType, receivingDate, header: { billNo, billDate, supplierName }, rows: [...] }
 * - Every row is saved as its own inward entry with its own unit; nothing is merged or converted.
 * - All rows are validated first; on any error nothing is saved.
 * - Rows already in Inward Stock (same bill, fabric, colour, quantity and unit) are skipped unless the
 *   row says allowDuplicate.
 * - All inward rows and their stock postings are written in one transaction; if anything fails nothing
 *   is saved and the same request can be sent again.
 * - confirmKey makes retries safe: repeating a confirm returns the first result instead of adding twice.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;
  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send the reviewed rows as JSON.' }, { status: 400 });
  }
  const confirmKey = String(body?.confirmKey || '');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(confirmKey)) {
    return NextResponse.json({ error: 'confirmKey is required (8-100 letters, digits, - or _).' }, { status: 400 });
  }

  try {
    const existing = await prisma.stockImport.findUnique({
      where: { id },
      select: { status: true, confirmKey: true, resultJson: true, confirmedAt: true },
    });
    if (!existing) return NextResponse.json({ error: 'Import not found.' }, { status: 404 });
    const replay = alreadyDone(existing, confirmKey);
    if (replay) return replay;

    const { errors, lines, entryType, receivingDate } = validateConfirmRows(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Some rows need fixing before they can be added.', details: errors }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockFabricStock(tx);
      // Claims the import; a second confirm (another tab, a retry) finds it no longer EXTRACTED.
      const claimed = await tx.stockImport.updateMany({
        where: { id, status: 'EXTRACTED' },
        data: {
          status: 'CONFIRMED',
          confirmKey,
          confirmedById: user.id,
          confirmedAt: new Date(),
          confirmedJson: JSON.parse(JSON.stringify({ entryType, receivingDate, header: body.header ?? null, rows: body.rows })),
        },
      });
      if (claimed.count === 0) throw new ImportConflict();

      const billNos = [...new Set(lines.map((line) => line.billNo))];
      const already = await tx.fabricInward.findMany({
        where: { OR: billNos.map((billNo) => ({ billNo: { equals: billNo, mode: 'insensitive' as const } })) },
        select: { sNo: true, billNo: true, itemName: true, colour: true, billQty: true, unit: true },
      });
      const inStock = new Map<string, number>();
      for (const row of already) if (!inStock.has(inwardDuplicateKey(row))) inStock.set(inwardDuplicateKey(row), row.sNo);

      const skipped: ImportResult['skipped'] = [];
      const toAdd = lines.filter((line) => {
        const sNo = inStock.get(inwardDuplicateKey(line));
        if (sNo !== undefined && !line.allowDuplicate) {
          skipped.push({
            rowNo: line.rowNo,
            itemName: line.itemName,
            reason: `Already in Inward Stock (entry #${sNo}, bill ${line.billNo}, ${line.billQty} ${line.unit}).`,
          });
          return false;
        }
        return true;
      });

      // sNo is assigned in insert order, so sorting by it lines the rows up with toAdd.
      const created = toAdd.length
        ? await tx.fabricInward.createManyAndReturn({
            data: toAdd.map((line) => ({
              entryType,
              itemName: line.itemName,
              colour: line.colour,
              billNo: line.billNo,
              billDate: line.billDate!,
              receivingDate: receivingDate!,
              billQty: line.billQty,
              unit: line.unit!,
              supplierName: line.supplierName,
              remarks: line.remarks,
            })),
          })
        : [];
      created.sort((a, b) => a.sNo - b.sNo);
      await postNewInwardStock(tx, created, user.id);

      const added: ImportResult['added'] = created.map((row, index) => ({
        rowNo: toAdd[index].rowNo,
        id: row.id,
        sNo: row.sNo,
        itemName: row.itemName,
        colour: row.colour,
        billQty: row.billQty,
        unit: row.unit,
      }));
      const totals = { MTR: 0, PCS: 0 };
      for (const row of added) totals[row.unit === 'PCS' ? 'PCS' : 'MTR'] = Math.round((totals[row.unit === 'PCS' ? 'PCS' : 'MTR'] + row.billQty) * 1000) / 1000;
      const result: ImportResult = { added, skipped, totals };

      await tx.stockImport.update({
        where: { id },
        data: { resultJson: JSON.parse(JSON.stringify(result)), addedCount: added.length, skippedCount: skipped.length },
      });
      return result;
    }, STOCK_TRANSACTION_OPTIONS);

    return NextResponse.json({ success: true, replayed: false, ...result }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ImportConflict || error?.code === 'P2002') {
      // Lost a race with another confirm; if it was this same request (a retry), return its result.
      const now = await prisma.stockImport.findUnique({
        where: { id },
        select: { status: true, confirmKey: true, resultJson: true, confirmedAt: true },
      }).catch(() => null);
      const replay = now && alreadyDone(now, confirmKey);
      if (replay) return replay;
      return NextResponse.json({ error: 'This import is already being added. Refresh to see the result.' }, { status: 409 });
    }
    if (error instanceof FabricStockError) return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    return apiErrorResponse(error, 'The rows could not be added. Nothing was saved; try again.', 'Stock sheet confirm failed:');
  }
}

/** The response for an import that can no longer be confirmed, or null when it still can. */
function alreadyDone(record: { status: string; confirmKey: string | null; resultJson: unknown; confirmedAt: Date | null }, confirmKey: string) {
  if (record.status === 'EXTRACTED') return null;
  if (record.status === 'CONFIRMED' && record.confirmKey === confirmKey && record.resultJson) {
    return NextResponse.json({ success: true, replayed: true, ...(record.resultJson as object) }, { status: 200 });
  }
  if (record.status === 'CONFIRMED') {
    return NextResponse.json(
      { error: `This file was already added to stock${record.confirmedAt ? ` on ${record.confirmedAt.toLocaleString('en-IN')}` : ''}. Upload it again only if it is a new delivery.` },
      { status: 409 },
    );
  }
  if (record.status === 'DISCARDED') return NextResponse.json({ error: 'This import was discarded. Upload the file again.' }, { status: 409 });
  return NextResponse.json({ error: 'This file could not be read, so there is nothing to add.' }, { status: 409 });
}
