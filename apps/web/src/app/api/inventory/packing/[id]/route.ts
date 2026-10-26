import { updatePacking } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** POST { idempotencyKey, action: START | PACK | RETURN, quantity?, remarks? } */
export const POST = async (request: Request, { params }: Ctx) => updatePacking(request, (await params).id);
