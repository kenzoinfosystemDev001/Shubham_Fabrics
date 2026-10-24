import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { dismissAlertForUser } from '@/lib/deadline-alerts/engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/alerts/:id/dismiss
 * Dismisses the alert for the signed-in user only. Never changes the underlying work.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: authUser, response: authResponse } = await requireUser(request);
  if (!authUser) return authResponse;

  try {
    const { id } = await params;
    const result = await dismissAlertForUser(authUser, id);
    if (result.status === 404) {
      return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    }
    return NextResponse.json(
      { data: { alertId: id, dismissedAt: result.dismissal.dismissedAt } },
      { status: result.status },
    );
  } catch (error: any) {
    console.error('Error dismissing deadline alert:', error);
    return NextResponse.json({ error: 'Failed to dismiss alert.' }, { status: 500 });
  }
}
