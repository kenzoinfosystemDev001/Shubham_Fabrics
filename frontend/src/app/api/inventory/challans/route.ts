import { listIncoming } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

/** GET ?view=pending|received|all&search= — Final QC challans to Inventory (garment lines, no fabric fields). */
export const GET = (request: Request) => listIncoming(request);
