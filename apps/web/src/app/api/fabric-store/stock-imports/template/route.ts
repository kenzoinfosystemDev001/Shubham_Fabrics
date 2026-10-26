import { fileResponse, withStoreUser } from '@/lib/fabric-stock-import/http';
import { knownFabricNames } from '@/lib/fabric-stock-import/service';
import { buildTemplate } from '@/lib/fabric-stock-import/workbook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/fabric-store/stock-imports/template - Excel template generated from the import fields
export async function GET(request: Request) {
  return withStoreUser(request, async () => {
    const data = await buildTemplate(await knownFabricNames());
    return fileResponse(data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'fabric-stock-inward-template.xlsx');
  });
}
