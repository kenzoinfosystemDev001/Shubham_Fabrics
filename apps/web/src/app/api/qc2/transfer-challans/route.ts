import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.QC2);

/** Embroidery -> Thread Cutting challans. */
export const GET = (request: Request) => h.listTransferChallans(request);
/** POST { idempotencyKey, challanNumber, issuedDate?, remarks?, lines: [{ workItemId, quantity, remarks? }] } */
export const POST = (request: Request) => h.issueTransferChallan(request);
