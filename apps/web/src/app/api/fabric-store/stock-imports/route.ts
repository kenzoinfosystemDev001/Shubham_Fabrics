import { NextResponse } from 'next/server';
import { fileResponse, withStoreUser } from '@/lib/fabric-stock-import/http';
import { StockImportError, createImport, listImports, presentImport } from '@/lib/fabric-stock-import/service';
import { IMPORT_LIMITS } from '@/lib/fabric-stock-import/workbook-guard.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Reading a PDF or photo with the document reader can take a couple of minutes.
export const maxDuration = 300;

// GET /api/fabric-store/stock-imports?page=1&pageSize=20 - import history, newest first
export async function GET(request: Request) {
  return withStoreUser(request, async () => {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || 1) || 1;
    const pageSize = Number(searchParams.get('pageSize') || 20) || 20;
    return NextResponse.json(await listImports(page, pageSize));
  });
}

// POST /api/fabric-store/stock-imports (multipart, field "file") - upload a stock document (Excel, CSV, PDF or photo)
export async function POST(request: Request) {
  return withStoreUser(request, async (user) => {
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > IMPORT_LIMITS.maxFileBytes + 64 * 1024) {
      throw new StockImportError(`The file is larger than ${IMPORT_LIMITS.maxFileBytes / 1048576} MB.`, 413, 'TOO_LARGE');
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new StockImportError('Upload the file as multipart form data in a field named "file".', 400, 'BAD_UPLOAD');
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') throw new StockImportError('Choose a file to upload.', 400, 'NO_FILE');
    if (file.size > IMPORT_LIMITS.maxFileBytes) {
      throw new StockImportError(`The file is larger than ${IMPORT_LIMITS.maxFileBytes / 1048576} MB.`, 413, 'TOO_LARGE');
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const record = await createImport({ name: file.name, bytes }, user);
    return NextResponse.json(presentImport(record, user), { status: 201 });
  });
}
