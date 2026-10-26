import { recuttingHandlers as h } from '@/lib/recutting-server';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => h.dashboard(request);
