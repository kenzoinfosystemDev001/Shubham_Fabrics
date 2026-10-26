import { NextResponse } from 'next/server';
import { withStoreUser } from '@/lib/fabric-stock-import/http';
import { cancelImport, presentImport } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

// POST /api/fabric-store/stock-imports/:id/cancel - abandon an unposted import
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    return NextResponse.json(presentImport(await cancelImport(id, user), user));
  });
}
