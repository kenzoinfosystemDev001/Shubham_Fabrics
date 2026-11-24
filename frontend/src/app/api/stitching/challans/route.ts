import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.STITCHING);

/** GET ?view=pending|received|all&search= — Fabric Store and Dyeing QC (PASS) challans to Embroidery. */
export const GET = (request: Request) => h.listChallans(request);
