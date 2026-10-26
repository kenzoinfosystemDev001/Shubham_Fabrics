import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';
const h = workflowHandlers(WORKFLOWS.FINAL_CHECK);

/** GET ?kind=PASS|REJECT|REWORK&search= — Final QC challans to Inventory, the Fabric Store Defective Shelf or Steam Press (rework). */
export const GET = (request: Request) => h.listTransferChallans(request);
/** POST { idempotencyKey, kind?, challanNumber, issuedDate?, priority?, remarks?, lines: [{ workItemId, quantity, remarks? }] } */
export const POST = (request: Request) => h.issueTransferChallan(request);
