import { transactions } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

/** GET ?type=&search=&from=&to=&page=&pageSize= — the inventory ledger. */
export const GET = (request: Request) => transactions(request);
