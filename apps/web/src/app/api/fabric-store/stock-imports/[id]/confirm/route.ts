import { NextResponse } from 'next/server';
import { readJson, withStoreUser } from '@/lib/fabric-stock-import/http';
import { confirmImport, getImport, presentImport } from '@/lib/fabric-stock-import/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/fabric-store/stock-imports/:id/confirm { idempotencyKey, payloadHash, acknowledgeWarnings }
// Posts the import to stock once; retries return the original receipt.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStoreUser(request, async (user) => {
    const { id } = await params;
    const body = await readJson(request);
    const { result, replayed } = await confirmImport(
      id,
      { idempotencyKey: request.headers.get('Idempotency-Key') || body.idempotencyKey, payloadHash: body.payloadHash, acknowledgeWarnings: body.acknowledgeWarnings },
      user,
    );
    return NextResponse.json({ result, replayed, import: presentImport(await getImport(id), user) }, { status: replayed ? 200 : 201 });
  });
}
