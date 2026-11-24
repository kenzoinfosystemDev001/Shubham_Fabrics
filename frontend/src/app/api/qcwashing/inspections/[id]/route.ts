import { WORKFLOWS, workflowHandlers } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';

const h = workflowHandlers(WORKFLOWS.QC3);
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = async (request: Request, { params }: Ctx) => h.editInspection(request, (await params).id);
