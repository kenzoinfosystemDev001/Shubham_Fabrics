import { prisma } from '@subham/database';
import { fileResponse, withStoreUser } from '@/lib/fabric-stock-import/http';
import { StockImportError } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/stock-imports/:id/file - the original uploaded workbook
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async () => {
    const { id } = await params;
    const record = await prisma.fabricStockImport.findUnique({ where: { id }, select: { fileName: true, fileData: true } });
    if (!record) throw new StockImportError('Import not found.', 404, 'NOT_FOUND');
    return fileResponse(record.fileData, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', record.fileName);
  });
}
