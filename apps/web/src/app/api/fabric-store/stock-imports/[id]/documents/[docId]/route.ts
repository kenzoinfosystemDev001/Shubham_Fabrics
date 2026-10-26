import { prisma } from '@subham/database';
import { fileResponse, withStoreUser } from '@/lib/fabric-stock-import/http';
import { StockImportError } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/tiff': 'tif', 'image/webp': 'webp' };

// GET /api/fabric-store/stock-imports/:id/documents/:docId - an image embedded in the workbook
export async function GET(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  return withStoreUser(request, async () => {
    const { id, docId } = await params;
    const doc = await prisma.fabricStockImportDocument.findFirst({ where: { id: docId, importId: id }, select: { mimeType: true, data: true } });
    if (!doc) throw new StockImportError('Document not found.', 404, 'NOT_FOUND');
    return fileResponse(doc.data, doc.mimeType, `invoice-image-${docId.slice(0, 8)}.${EXTENSIONS[doc.mimeType] || 'bin'}`);
  });
}
