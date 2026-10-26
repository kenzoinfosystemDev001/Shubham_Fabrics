import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { apiErrorResponse } from '@/lib/api-errors';
import { importSummary, uploaderNames } from '@/lib/stock-import-records';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const SUMMARY = {
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
} as const;

// GET /api/fabric-store/inward/import/:id - one import: what was read, what was confirmed and the result.
export async function GET(request: Request, { params }: Ctx) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;
  const { id } = await params;
  try {
    const record = await prisma.stockImport.findUnique({
      where: { id },
      select: { ...SUMMARY, extractedJson: true, confirmedJson: true, resultJson: true },
    });
    if (!record) return NextResponse.json({ error: 'Import not found.' }, { status: 404 });
    const names = await uploaderNames([record.uploadedById, record.confirmedById]);
    return NextResponse.json({
      import: importSummary(record, names),
      extracted: record.extractedJson,
      confirmed: record.confirmedJson,
      result: record.resultJson,
    });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load the import.');
  }
}

// DELETE /api/fabric-store/inward/import/:id - discard an import that was read but not confirmed.
// The record and its file stay for the audit trail; it can no longer be confirmed.
export async function DELETE(request: Request, { params }: Ctx) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;
  const { id } = await params;
  try {
    const { count } = await prisma.stockImport.updateMany({ where: { id, status: 'EXTRACTED' }, data: { status: 'DISCARDED' } });
    if (count === 0) {
      const exists = await prisma.stockImport.findUnique({ where: { id }, select: { status: true } });
      if (!exists) return NextResponse.json({ error: 'Import not found.' }, { status: 404 });
      if (exists.status !== 'DISCARDED') {
        return NextResponse.json({ error: 'This import was already added to stock and cannot be discarded.' }, { status: 409 });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to discard the import.');
  }
}
