import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { apiErrorResponse } from '@/lib/api-errors';
import { MAX_IMPORT_FILE_BYTES, inwardDuplicateKey, safeFileName, sniffImportFile } from '@/lib/stock-import-rules.mjs';
import { ImportFileError, ImportServiceError, readExcel, readPhoto } from '@/lib/stock-import-server';
import { importSummary, uploaderNames } from '@/lib/stock-import-records';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Reading a handwritten page can take a minute or two.
export const maxDuration = 300;

// GET /api/fabric-store/inward/import - upload history (newest first), without the files themselves.
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;
  try {
    const imports = await prisma.stockImport.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        source: true,
        fileName: true,
        fileSize: true,
        status: true,
        rowCount: true,
        engine: true,
        uploadedById: true,
        uploadedAt: true,
        confirmedById: true,
        confirmedAt: true,
        addedCount: true,
        skippedCount: true,
      },
    });
    const names = await uploaderNames(imports.flatMap((i) => [i.uploadedById, i.confirmedById]));
    return NextResponse.json({ data: imports.map((i) => importSummary(i, names)) });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load the upload history.');
  }
}

/**
 * POST /api/fabric-store/inward/import - multipart "file": a JPG/PNG photo or scan, or an .xlsx/.xls
 * workbook (10 MB at most). Reads the stock rows and keeps the file for audit. Nothing is added to stock
 * here; the rows come back for review and are added only by .../import/:id/confirm.
 */
export async function POST(request: Request) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_IMPORT_FILE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'The file is larger than 10 MB. Upload a smaller photo or split the workbook.' }, { status: 413 });
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get('file');
    file = value instanceof File ? value : null;
  } catch {
    return NextResponse.json({ error: 'Upload the file as form data in a field named "file".' }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: 'Choose a photo, scan or Excel file to upload.' }, { status: 400 });
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return NextResponse.json({ error: 'The file is larger than 10 MB. Upload a smaller photo or split the workbook.' }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = safeFileName(file.name);
  const kind = sniffImportFile(bytes, fileName);
  if (!kind) {
    return NextResponse.json(
      { error: 'Only JPG, JPEG or PNG photos/scans and Excel files (.xlsx, .xls) can be uploaded, and the file must really be of that type.' },
      { status: 415 },
    );
  }
  const fileHash = createHash('sha256').update(bytes).digest('hex');

  try {
    const previous = await prisma.stockImport.findFirst({
      where: { fileHash, status: { in: ['CONFIRMED', 'EXTRACTED'] } },
      orderBy: [{ confirmedAt: { sort: 'desc', nulls: 'last' } }, { uploadedAt: 'desc' }],
      select: { id: true, fileName: true, status: true, uploadedAt: true, uploadedById: true, confirmedAt: true, confirmedById: true, addedCount: true, skippedCount: true, rowCount: true, source: true, fileSize: true, engine: true },
    });

    let extraction;
    try {
      extraction = kind.source === 'EXCEL' ? readExcel(bytes) : await readPhoto(bytes);
    } catch (error) {
      if (error instanceof ImportFileError) {
        // Kept for the audit trail: who uploaded what, and why it could not be read.
        await prisma.stockImport.create({
          data: {
            source: kind.source,
            fileName,
            mimeType: kind.mimeType,
            fileSize: bytes.length,
            fileHash,
            fileData: bytes,
            status: 'FAILED',
            extractedJson: { error: error.message },
            uploadedById: user.id,
          },
        });
        return NextResponse.json({ error: error.message }, { status: 422 });
      }
      if (error instanceof ImportServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
      throw error;
    }

    const record = await prisma.stockImport.create({
      data: {
        source: kind.source,
        fileName,
        mimeType: kind.mimeType,
        fileSize: bytes.length,
        fileHash,
        fileData: bytes,
        status: 'EXTRACTED',
        extractedJson: JSON.parse(JSON.stringify(extraction)),
        rowCount: extraction.rows.length,
        engine: extraction.engine,
        uploadedById: user.id,
      },
      select: { id: true, source: true, fileName: true, fileSize: true, status: true, rowCount: true, engine: true, uploadedById: true, uploadedAt: true, confirmedById: true, confirmedAt: true, addedCount: true, skippedCount: true },
    });

    // Inward entries already recorded for these bills, so the review can flag rows that are already in stock.
    const billNos = [...new Set([extraction.header.billNo, ...extraction.rows.map((r) => r.billNo)].filter((b): b is string => Boolean(b)))];
    const existing = billNos.length
      ? await prisma.fabricInward.findMany({
          where: { OR: billNos.map((billNo) => ({ billNo: { equals: billNo, mode: 'insensitive' as const } })) },
          select: { sNo: true, billNo: true, itemName: true, colour: true, billQty: true, unit: true },
          take: 2000,
        })
      : [];

    const names = await uploaderNames([record.uploadedById, previous?.uploadedById, previous?.confirmedById]);
    return NextResponse.json(
      {
        import: importSummary(record, names),
        header: extraction.header,
        rows: extraction.rows,
        notes: extraction.notes,
        duplicateOf: previous ? importSummary(previous, names) : null,
        existing: existing.map((row) => ({ key: inwardDuplicateKey(row), sNo: row.sNo })),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, 'The file could not be read. Try again.', 'Stock sheet import failed:');
  }
}
