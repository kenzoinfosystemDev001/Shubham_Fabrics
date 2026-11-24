import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.THREAD_CUTTING);
type Ctx = { params: Promise<{ id: string }> };

export const GET = async (request: Request, { params }: Ctx) => h.getItem(request, (await params).id);
/** PATCH { status?, processedQuantity?, expectedCompletionDate?, remarks? } */
export const PATCH = async (request: Request, { params }: Ctx) => h.updateItem(request, (await params).id);
