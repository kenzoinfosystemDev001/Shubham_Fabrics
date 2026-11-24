import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { deleteRecord, recordDeleteImpact } from '@/lib/record-delete-server';

export const dynamic = 'force-dynamic';

/**
 * GET ?kind=RECEIPT_WORK_ITEM|RECEIPT_DYEING_ORDER|RECEIPT_CHALLAN|HOLD&id= : what deleting the record would do and
 * why it cannot be done yet (lib/record-delete-server.ts). Nothing is changed.
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const p = new URL(request.url).searchParams;
    return NextResponse.json({ data: await recordDeleteImpact(p.get('kind'), String(p.get('id') || ''), user) });
  } catch (error) {
    return errorResponse(error, 'Failed to check what this delete would affect.');
  }
}

/** POST { kind, id, reason } : deletes the record (department users: their own department's; administrators: any). */
export async function POST(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const message = await deleteRecord(body?.kind, String(body?.id || ''), body?.reason, user);
    return NextResponse.json({ message });
  } catch (error) {
    return errorResponse(error, 'Failed to delete the record.');
  }
}
