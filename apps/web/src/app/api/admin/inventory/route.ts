import { adminInventory } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

/** GET ?view=overview|records|counts — finished goods inventory and packing, factory-wide (administrators only). */
export const GET = (request: Request) => adminInventory(request);
