import { receiveChallan } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** POST { lines: [{ workItemId, receivedQuantity, remarks? }], remarks? } — whole pieces, never above the dispatched quantity. */
export const POST = async (request: Request, { params }: Ctx) => receiveChallan(request, (await params).id);
