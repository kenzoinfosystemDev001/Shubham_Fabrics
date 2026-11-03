import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { holdDepartmentsFor, holdSummary, releasesOf } from '@/lib/holds-server';

export const dynamic = 'force-dynamic';

/**
 * GET ?department=CODE|ALL&mode=AVAILABLE|FORWARD&search= : HOLD Release History of the department (ALL:
 * administrators), newest first, with the HOLD totals (held, released, forwarded; MTR and PCS apart).
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const p = new URL(request.url).searchParams;
    const departments = holdDepartmentsFor(user, p.get('department'));
    const mode = p.get('mode')?.toUpperCase();
    const q = p.get('search')?.trim();
    const ci = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const [data, summary] = await Promise.all([
      releasesOf({
        departmentCode: { in: departments },
        ...(mode === 'AVAILABLE' || mode === 'FORWARD' ? { mode } : {}),
        ...(q
          ? {
              OR: [
                { originalChallanNumber: ci(q) },
                { newChallanNumber: ci(q) },
                { hold: { OR: [{ holdNumber: ci(q) }, { designNumber: ci(q) }, { serialNumber: ci(q) }, { productionSheetNumber: ci(q) }, { fabricName: ci(q) }] } },
              ],
            }
          : {}),
      }),
      holdSummary(departments),
    ]);
    return NextResponse.json({ data, summary });
  } catch (error) {
    return errorResponse(error, 'Failed to load the HOLD release history.');
  }
}
