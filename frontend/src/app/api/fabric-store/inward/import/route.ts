import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { apiErrorResponse } from '@/lib/api-errors';
import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  lockFabricStock,
  postNewInwardStock,
} from '@/lib/fabric-stock-ledger';
import { MAX_IMPORT_FILE_BYTES, inwardDuplicateKey, safeFileName, sniffImportFile, validateConfirmRows } from '@/lib/stock-import-rules.mjs';
import { ImportFileError, readExcel } from '@/lib/stock-import-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/fabric-store/inward/import — multipart: file (.xlsx / .xls, 10 MB at most), entryType
 * (UNDYED | DYED), receivingDate (YYYY-MM-DD, default today).
 *
 * Reads the stock sheet and adds every complete row to Inward Stock as its own entry, with its own unit
 * (MTR or PCS, never converted), through the same stock ledger as a manual arrival — all in one
 * transaction, so a failure adds nothing. Rows that are incomplete, or already in Inward Stock (same bill,
 * fabric, colour, quantity and unit, e.g. the same file uploaded twice), are skipped with the reason.
 */
export async function POST(request: Request) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;

  if (Number(request.headers.get('content-length') || 0) > MAX_IMPORT_FILE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'The file is larger than 10 MB. Split the workbook and upload each part.' }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Upload the Excel file as form data in a field named "file".' }, { status: 400 });
  }
  const value = form.get('file');
  const file = value instanceof File ? value : null;
  if (!file || file.size === 0) return NextResponse.json({ error: 'Choose an Excel file (.xlsx or .xls) to upload.' }, { status: 400 });
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return NextResponse.json({ error: 'The file is larger than 10 MB. Split the workbook and upload each part.' }, { status: 413 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = safeFileName(file.name);
  if (!sniffImportFile(bytes, fileName)) {
    return NextResponse.json({ error: 'Only Excel files (.xlsx or .xls) can be uploaded, and the file must really be an Excel workbook.' }, { status: 415 });
  }

  let sheet;
  try {
    sheet = readExcel(bytes);
  } catch (error) {
    if (error instanceof ImportFileError) return NextResponse.json({ error: error.message }, { status: 422 });
    throw error;
  }

  const entryType = String(form.get('entryType') || 'UNDYED');
  const receivingDate = String(form.get('receivingDate') || '') || new Date().toISOString().slice(0, 10);
  const base = { entryType, receivingDate, header: sheet.header };
  const settings = validateConfirmRows({ ...base, rows: [{ rowNo: 0, itemName: 'x', quantity: 1, unit: 'MTR', billNo: 'x', billDate: '2000-01-01' }] });
  if (settings.errors.length) return NextResponse.json({ error: settings.errors.join(' ') }, { status: 400 });

  // Each row is checked on its own: complete rows are added, the rest are listed with the reason.
  const skipped: Array<{ rowNo: number; source: string; itemName: string | null; reason: string }> = [];
  const lines: Array<ReturnType<typeof validateConfirmRows>['lines'][number] & { source: string }> = [];
  for (const row of sheet.rows) {
    const check = validateConfirmRows({ ...base, rows: [row] });
    if (check.errors.length) {
      skipped.push({ rowNo: row.rowNo, source: row.source, itemName: row.itemName, reason: check.errors[0].replace(/^Row \d+: /, '') });
    } else {
      lines.push({ ...check.lines[0], source: row.source });
    }
  }

  try {
    const added = await prisma.$transaction(async (tx) => {
      await lockFabricStock(tx);
      const billNos = [...new Set(lines.map((line) => line.billNo))];
      const existing = billNos.length
        ? await tx.fabricInward.findMany({
            where: { OR: billNos.map((billNo) => ({ billNo: { equals: billNo, mode: 'insensitive' as const } })) },
            select: { sNo: true, billNo: true, itemName: true, colour: true, billQty: true, unit: true },
          })
        : [];
      const inStock = new Map<string, number>();
      for (const row of existing) if (!inStock.has(inwardDuplicateKey(row))) inStock.set(inwardDuplicateKey(row), row.sNo);
      const toAdd = lines.filter((line) => {
        const sNo = inStock.get(inwardDuplicateKey(line));
        if (sNo === undefined) return true;
        skipped.push({ rowNo: line.rowNo, source: line.source, itemName: line.itemName, reason: `already in Inward Stock (entry #${sNo})` });
        return false;
      });
      if (toAdd.length === 0) return [];
      const created = await tx.fabricInward.createManyAndReturn({
        data: toAdd.map((line) => ({
          entryType: settings.entryType,
          itemName: line.itemName,
          colour: line.colour,
          billNo: line.billNo,
          billDate: line.billDate!,
          receivingDate: line.receivingDate!,
          billQty: line.billQty,
          unit: line.unit!,
          supplierName: line.supplierName,
          billerStateCity: line.billerStateCity,
          pricePerUnit: line.pricePerUnit,
          boxThanQty: line.boxThanQty,
          hsnCode: line.hsnCode,
          taxPercent: line.taxPercent,
          remarks: line.remarks,
        })),
      });
      created.sort((a, b) => a.sNo - b.sNo);
      await postNewInwardStock(tx, created, user.id);
      return created;
    }, STOCK_TRANSACTION_OPTIONS);

    const totals = { MTR: 0, PCS: 0 };
    for (const row of added) {
      const unit = row.unit === 'PCS' ? 'PCS' : 'MTR';
      totals[unit] = Math.round((totals[unit] + row.billQty) * 1000) / 1000;
    }
    skipped.sort((a, b) => a.rowNo - b.rowNo);
    return NextResponse.json({ fileName, added: added.length, totals, skipped, notes: sheet.notes }, { status: added.length ? 201 : 200 });
  } catch (error) {
    if (error instanceof FabricStockError) return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    return apiErrorResponse(error, 'The stock sheet could not be added. Nothing was saved; try again.', 'Stock sheet import failed:');
  }
}
