import { changeQc1Decision, qc1DecisionState } from '@/lib/qc1-decision-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// Change a Dyeing QC decision (REWORK <-> HOLD) of this challan, and read its decisions and earlier changes.
export const GET = async (request: Request, { params }: Ctx) => qc1DecisionState(request, (await params).id);
export const POST = async (request: Request, { params }: Ctx) => changeQc1Decision(request, (await params).id);
