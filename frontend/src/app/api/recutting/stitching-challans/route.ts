import { recuttingHandlers as h } from '@/lib/recutting-server';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => h.listStitchingChallans(request);
export const POST = (request: Request) => h.issueStitchingChallan(request);
