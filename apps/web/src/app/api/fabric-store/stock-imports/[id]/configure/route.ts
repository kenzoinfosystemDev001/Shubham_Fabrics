import { NextResponse } from 'next/server';
import { readJson, withStoreUser } from '@/lib/fabric-stock-import/http';
import { configureImport, presentImport } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

// POST /api/fabric-store/stock-imports/:id/configure { sheetName, headerRow, mapping }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    const body = await readJson(request);
    const record = await configureImport(id, { sheetName: body.sheetName, headerRow: body.headerRow, mapping: body.mapping }, user);
    return NextResponse.json(presentImport(record, user));
  });
}
