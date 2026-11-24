import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { holdCandidates, holdDepartmentsFor } from '@/lib/holds-server';

export const dynamic = 'force-dynamic';

/** GET ?department=CODE : lines of the department with quantity still in it and no open HOLD. */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const raw = new URL(request.url).searchParams.get('department');
    const [code] = holdDepartmentsFor(user, raw && raw.toUpperCase() !== 'ALL' ? raw : '');
    return NextResponse.json({ data: await holdCandidates(code) });
  } catch (error) {
    return errorResponse(error, 'Failed to load the lines that can be placed on HOLD.');
  }
}
