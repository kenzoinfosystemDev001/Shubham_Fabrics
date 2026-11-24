import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { apiErrorResponse } from '@/lib/api-errors';
import { WorkRequestError } from '@/lib/work-items-server';
import { issuedCount, issuingDepartmentFor, listIssuedChallans, type IssuedFilters } from '@/lib/issued-challans-server';

export const dynamic = 'force-dynamic';

const FILTER_KEYS: Array<keyof IssuedFilters> = ['q', 'toDepartment', 'from', 'to', 'status', 'fabric', 'style', 'sort', 'page', 'pageSize'];

// GET /api/challans/issued?department=WASHING&page=1&... — Floor Board > COMPLETED: challans issued by one
// department (members of that department; administrators any, or department=ALL). countsOnly=1 returns the
// badge count only.
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const params = new URL(request.url).searchParams;
    const dept = issuingDepartmentFor(user, params.get('department'));
    const count = await issuedCount(dept);
    if (params.get('countsOnly') === '1') return NextResponse.json({ department: dept, count });
    const filters: IssuedFilters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k)]));
    return NextResponse.json({ department: dept, count, ...(await listIssuedChallans(dept, filters)) });
  } catch (error) {
    if (error instanceof WorkRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiErrorResponse(error, 'Could not load the issued challans.', 'Issued challans failed:');
  }
}
