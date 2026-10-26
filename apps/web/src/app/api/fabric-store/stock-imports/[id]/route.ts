import { NextResponse } from 'next/server';
import { withStoreUser } from '@/lib/fabric-stock-import/http';
import { getImport, presentImport } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

// GET /api/fabric-store/stock-imports/:id - import, preview, validation and (when posted) receipt
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    return NextResponse.json(presentImport(await getImport(id), user));
  });
}
