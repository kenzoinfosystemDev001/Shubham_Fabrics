import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { WorkRequestError, errorResponse } from '@/lib/work-items-server';
import { holdDepartmentsFor, holdsOfSource } from '@/lib/holds-server';

export const dynamic = 'force-dynamic';

/** GET ?department=CODE&sourceId= : the lines of one dyeing order / work item with their open HOLD. */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('department');
    const [code] = holdDepartmentsFor(user, raw && raw.toUpperCase() !== 'ALL' ? raw : '');
    const sourceId = (searchParams.get('sourceId') || '').trim();
    if (!sourceId) throw new WorkRequestError('Select the line to place on HOLD.');
    return NextResponse.json({ data: await holdsOfSource(code, sourceId) });
  } catch (error) {
    return errorResponse(error, 'Failed to load the HOLD of this line.');
  }
}
