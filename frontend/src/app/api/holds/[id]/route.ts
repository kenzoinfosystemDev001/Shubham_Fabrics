import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { holdDetail } from '@/lib/holds-server';

export const dynamic = 'force-dynamic';

/** GET : one HOLD record with its full history (placed, releases, forwarding, closing). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { id } = await params;
    return NextResponse.json({ data: await holdDetail(id, user) });
  } catch (error) {
    return errorResponse(error, 'Failed to load the HOLD record.');
  }
}
