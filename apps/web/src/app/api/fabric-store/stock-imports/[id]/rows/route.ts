import { NextResponse } from 'next/server';
import { readJson, withStoreUser } from '@/lib/fabric-stock-import/http';
import { correctRow, presentImport } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

// PATCH /api/fabric-store/stock-imports/:id/rows { rowNumber, field, value } (value null removes the correction)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    const body = await readJson(request);
    const record = await correctRow(id, { rowNumber: body.rowNumber, field: body.field, value: body.value }, user);
    return NextResponse.json(presentImport(record, user));
  });
}
