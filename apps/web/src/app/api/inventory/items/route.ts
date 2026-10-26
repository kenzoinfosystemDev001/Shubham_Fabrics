import { listRecords } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

/** GET ?search=&category=&status=&from=&to=&sort=&page=&pageSize= — finished garment records. */
export const GET = (request: Request) => listRecords(request);
