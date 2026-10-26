import { fileResponse, withStoreUser } from '@/lib/fabric-stock-import/http';
import { StockImportError, getImport, presentImport } from '@/lib/fabric-stock-import/service';
import { buildValidationReport } from '@/lib/fabric-stock-import/workbook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/fabric-store/stock-imports/:id/report - validation report (.xlsx)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    const view = presentImport(await getImport(id), user);
    if (!view.validation) throw new StockImportError('This import has not been validated yet.', 409, 'NOT_VALIDATED');
    const data = await buildValidationReport({
      fileName: view.fileName,
      receiptNumber: view.receiptNumber,
      status: view.status,
      rows: view.validation.rows,
      summary: view.validation.summary,
    });
    const name = `validation-${view.receiptNumber || view.id.slice(0, 8)}.xlsx`;
    return fileResponse(data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name);
  });
}
