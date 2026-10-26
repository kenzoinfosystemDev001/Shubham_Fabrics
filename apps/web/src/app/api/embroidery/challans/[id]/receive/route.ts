import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.EMBROIDERY);
type Ctx = { params: Promise<{ id: string }> };

/** POST { lines: [{ workItemId, receivedQuantity, remarks? }], remarks? } */
export const POST = async (request: Request, { params }: Ctx) => h.receiveChallan(request, (await params).id);
