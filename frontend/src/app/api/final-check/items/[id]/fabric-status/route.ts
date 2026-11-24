import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.FINAL_CHECK);
type Ctx = { params: Promise<{ id: string }> };

/** PATCH { fabricProcessingStatus: DYED|UNDYED, reason } — administrators only, audited. */
export const PATCH = async (request: Request, { params }: Ctx) => h.correctFabricStatus(request, (await params).id);
