import { recuttingHandlers as h } from '@/lib/recutting-server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
export const POST = async (request: Request, { params }: Ctx) => h.receiveChallan(request, (await params).id);
