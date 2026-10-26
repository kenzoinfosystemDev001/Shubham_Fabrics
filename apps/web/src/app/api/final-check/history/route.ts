import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.FINAL_CHECK);

/** GET ?view=lines|incoming|outgoing&from=&to=&challan=&sheet=&design=&fabric=&color=&fabricStatus=&status=&category=&reason=&reworkStatus=&dispatch= */
export const GET = (request: Request) => h.history(request);
