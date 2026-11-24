import { listPacking, sendForPacking } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

/** GET ?status=&search=&category=&from=&to=&page=&pageSize= — packing allocations. */
export const GET = (request: Request) => listPacking(request);
/** POST { idempotencyKey, workItemId, quantity, packingDate, priority?, remarks? } — Send for Packing. */
export const POST = (request: Request) => sendForPacking(request);
