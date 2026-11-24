import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.FINAL_CHECK);

/** GET ?status=&stage=&open=1&overdue=1&ready=1&programId=&outcome=PASS|REJECT|REWORK&inspection=&search= */
export const GET = (request: Request) => h.listItems(request);
