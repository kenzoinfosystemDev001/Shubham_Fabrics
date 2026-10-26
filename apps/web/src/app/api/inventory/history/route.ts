import { challanHistory } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

/** GET ?from=&to=&challan=&sheet=&design=&category=&color=&status= — challans received into Inventory. */
export const GET = (request: Request) => challanHistory(request);
