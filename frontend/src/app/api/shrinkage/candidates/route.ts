import { NextResponse } from 'next/server';
import { requireDepartment } from '@/lib/auth/department-access';
import { SHRINKAGE_NOT_SET_UP, listShrinkageCandidates, shrinkageTableExists } from '@/lib/shrinkage-server';

export const dynamic = 'force-dynamic';

// GET /api/shrinkage/candidates?search=   received Dyeing -> Dyeing QC lines without a shrinkage record
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'QC1');
  if (!user) return response;
  try {
    if (!(await shrinkageTableExists())) return NextResponse.json({ data: [], setupRequired: SHRINKAGE_NOT_SET_UP });
    const data = await listShrinkageCandidates(new URL(request.url).searchParams.get('search') || undefined);
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error loading fabric lines for shrinkage:', error);
    return NextResponse.json({ error: error.message || 'Failed to load fabric lines.' }, { status: 500 });
  }
}
