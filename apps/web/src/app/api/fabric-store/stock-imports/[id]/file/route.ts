import { prisma } from '@subham/database';
import { fileResponse, withStoreUser } from '@/lib/fabric-stock-import/http';
import { StockImportError } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

// GET /api/fabric-store/stock-imports/:id/file - the original uploaded file (workbook, PDF or photo)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async () => {
    const { id } = await params;
    const record = await prisma.fabricStockImport.findUnique({ where: { id }, select: { fileName: true, fileData: true } });
    if (!record) throw new StockImportError('Import not found.', 404, 'NOT_FOUND');
    const ext = record.fileName.toLowerCase().split('.').pop() || '';
    return fileResponse(record.fileData, CONTENT_TYPES[ext] || 'application/octet-stream', record.fileName);
  });
}
