import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.QC3);

/** GET ?view=lines|incoming|outgoing&from=&to=&challan=&sheet=&design=&fabric=&color=&fabricStatus=&status= */
export const GET = (request: Request) => h.history(request);
