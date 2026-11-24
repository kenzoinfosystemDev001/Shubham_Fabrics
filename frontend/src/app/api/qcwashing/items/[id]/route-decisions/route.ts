import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';

const h = workflowHandlers(WORKFLOWS.QC3);

// Older REJECT / REWORK still waiting for a challan: routed now, without one.
export const POST = async (request: Request, { params }: { params: Promise<{ id: string }> }) => h.routePending(request, (await params).id);
