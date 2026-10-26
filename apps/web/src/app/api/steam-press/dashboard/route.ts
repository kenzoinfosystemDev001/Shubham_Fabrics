import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.STEAM_PRESS);

export const GET = (request: Request) => h.dashboard(request);
