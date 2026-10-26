import { recuttingHandlers as h } from '@/lib/recutting-server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
export const GET = async (request: Request, { params }: Ctx) => h.getItem(request, (await params).id);
/** PATCH { expectedCompletionDate?, remarks? } (quantities change only through allocations) */
export const PATCH = async (request: Request, { params }: Ctx) => h.updateItem(request, (await params).id);
