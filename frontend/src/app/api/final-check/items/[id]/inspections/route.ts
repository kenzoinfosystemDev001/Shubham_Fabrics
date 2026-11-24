import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';

const h = workflowHandlers(WORKFLOWS.FINAL_CHECK);
type Ctx = { params: Promise<{ id: string }> };

export const POST = async (request: Request, { params }: Ctx) => h.inspectItem(request, (await params).id);
