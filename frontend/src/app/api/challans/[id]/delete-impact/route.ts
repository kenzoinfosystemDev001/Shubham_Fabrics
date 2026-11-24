import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { challanDeleteImpact } from '@/lib/admin-delete-server';

export const dynamic = 'force-dynamic';

/**
 * GET: what deleting this challan would do, and why this user cannot delete it yet (another department's challan,
 * already received, or later work built on it). Nothing is changed.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { id } = await params;
    return NextResponse.json({ data: await challanDeleteImpact(id, user) });
  } catch (error) {
    return errorResponse(error, 'Failed to check what deleting this challan would affect.');
  }
}
