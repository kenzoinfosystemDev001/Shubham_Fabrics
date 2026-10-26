import { NextResponse } from 'next/server';
import { readJson, withStoreUser } from '@/lib/fabric-stock-import/http';
import { presentImport, resolveFabric } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';

// POST /api/fabric-store/stock-imports/:id/fabrics { name, action: MAP | ACCEPT_NEW | CLEAR, target? }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    const body = await readJson(request);
    const record = await resolveFabric(id, { name: body.name, action: body.action, target: body.target }, user);
    return NextResponse.json(presentImport(record, user));
  });
}
