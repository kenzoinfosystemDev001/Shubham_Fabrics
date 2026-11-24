import { getRecord } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET — one record with its packing allocations and transactions. */
export const GET = async (request: Request, { params }: Ctx) => getRecord(request, (await params).id);
