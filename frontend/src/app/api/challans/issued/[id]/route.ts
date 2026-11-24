import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { apiErrorResponse } from '@/lib/api-errors';
import { WorkRequestError } from '@/lib/work-items-server';
import { issuedChallanDetail } from '@/lib/issued-challans-server';

export const dynamic = 'force-dynamic';

// GET /api/challans/issued/:id — one issued challan with line receipts and movement history (issuing department or administrators).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { id } = await params;
    return NextResponse.json({ data: await issuedChallanDetail(id, user) });
  } catch (error) {
    if (error instanceof WorkRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiErrorResponse(error, 'Could not load the challan.', 'Issued challan detail failed:');
  }
}
