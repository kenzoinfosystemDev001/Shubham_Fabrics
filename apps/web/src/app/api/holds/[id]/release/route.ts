import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { releaseHold } from '@/lib/holds-server';

export const dynamic = 'force-dynamic';

/** POST { quantity?, remarks? } : releases part (or, without a quantity, all) of what is still on HOLD. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await releaseHold(id, body, user);
    return NextResponse.json({ data, message: `${data.holdNumber}: ${data.releasedQuantity} ${data.unit} released in total, ${data.remainingQuantity} ${data.unit} still on HOLD.` });
  } catch (error) {
    return errorResponse(error, 'Failed to release the HOLD.');
  }
}
