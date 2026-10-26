import { recuttingHandlers as h } from '@/lib/recutting-server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
export const PATCH = async (request: Request, { params }: Ctx) => h.correctFabricStatus(request, (await params).id);
