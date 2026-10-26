import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.FINAL_CHECK);

/** GET ?view=pending|received|all&search= — Steam Press challans to Final QC. */
export const GET = (request: Request) => h.listChallans(request);
