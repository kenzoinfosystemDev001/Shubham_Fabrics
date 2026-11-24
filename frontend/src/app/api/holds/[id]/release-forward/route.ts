import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { challanNumberErrorResponse } from '@/lib/challan-number-server';
import { releaseAndForward } from '@/lib/hold-forward-server';

export const dynamic = 'force-dynamic';

/**
 * POST { quantity, challanNumber, issuedDate?, dyedColour?, remarks?, idempotencyKey } : releases quantity from the
 * HOLD and sends it to the department's next step on a new challan, in one transaction.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { release, replayed } = await releaseAndForward(id, body, user);
    return NextResponse.json(
      {
        data: release,
        replayed,
        message: `${release.quantity} ${release.unit} released from ${release.holdNumber} and forwarded to ${release.destinationName} on challan ${release.newChallanNumber}. ${release.remainingAfter} ${release.unit} still on HOLD.`,
      },
      { status: replayed ? 200 : 201 },
    );
  } catch (error) {
    return challanNumberErrorResponse(error) || errorResponse(error, 'Failed to release and forward the HOLD.');
  }
}
