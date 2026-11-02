import { WORKFLOWS } from '@/lib/work-items-server';
import { changeDecision, decisionHistory } from '@/lib/qc-decision-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// Change a QC decision (REJECT / REWORK / HOLD) of this line, and list its earlier changes.
export const POST = async (request: Request, { params }: Ctx) => changeDecision(request, WORKFLOWS.QC3, (await params).id);
export const GET = async (request: Request, { params }: Ctx) => decisionHistory(request, WORKFLOWS.QC3, (await params).id);
