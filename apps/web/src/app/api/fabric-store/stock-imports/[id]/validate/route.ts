import { NextResponse } from 'next/server';
import { withStoreUser } from '@/lib/fabric-stock-import/http';
import { presentImport, revalidateImport } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

// POST /api/fabric-store/stock-imports/:id/validate - re-check against current stock
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    return NextResponse.json(presentImport(await revalidateImport(id), user));
  });
}
