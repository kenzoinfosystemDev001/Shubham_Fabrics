import { dashboard } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

export const GET = (request: Request) => dashboard(request);
