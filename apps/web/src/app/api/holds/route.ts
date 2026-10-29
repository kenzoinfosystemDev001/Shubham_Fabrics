import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { HOLD_DEPARTMENTS, holdDepartmentsFor, listHolds, placeHold } from '@/lib/holds-server';
import { departmentName } from '@/lib/workflow-views';

export const dynamic = 'force-dynamic';

/** GET ?department=CODE|ALL&view=open|closed|all&search= : HOLD records of the department (ALL: administrators). */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { searchParams } = new URL(request.url);
    const departments = holdDepartmentsFor(user, searchParams.get('department'));
    const data = await listHolds(departments, searchParams.get('view'), searchParams.get('search') || '');
    return NextResponse.json({
      data,
      departments: departments.map((code) => ({ code, name: departmentName(code), receivedLabel: HOLD_DEPARTMENTS[code].receivedLabel })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load HOLD records.');
  }
}

/** POST { department, lineKey, quantity, unit, reason, reasonOther?, remarks? } : places a line on HOLD. */
export async function POST(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const [code] = holdDepartmentsFor(user, typeof body?.department === 'string' && body.department.toUpperCase() !== 'ALL' ? body.department : '');
    const data = await placeHold(code, body, user);
    return NextResponse.json({ data, message: `${data.holdQuantity} ${data.unit} placed on HOLD (${data.holdNumber}).` }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to place the HOLD.');
  }
}
