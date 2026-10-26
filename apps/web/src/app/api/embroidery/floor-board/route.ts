import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.EMBROIDERY);

export const GET = (request: Request) => h.floorBoard(request);
