import { recuttingHandlers as h } from '@/lib/recutting-server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
/** PATCH { cutQuantity?, styleRef?, remarks? } */
export const PATCH = async (request: Request, { params }: Ctx) => h.updateAllocation(request, (await params).id);
