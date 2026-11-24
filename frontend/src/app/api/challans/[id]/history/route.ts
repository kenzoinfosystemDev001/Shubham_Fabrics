import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
import { errorResponse } from '@/lib/work-items-server';
import { challanEditHistory } from '@/lib/challan-edit-server';

export const dynamic = 'force-dynamic';

/** GET: the challan's edit history (who, when, why, and each value before and after). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const { id } = await params;
    const challan = await prisma.challan.findUnique({ where: { id }, select: { fromDepartment: true, toDepartment: true } });
    if (!challan) return NextResponse.json({ error: 'Challan not found.' }, { status: 404 });
    if (!userBelongsToDepartment(user, challan.fromDepartment) && !userBelongsToDepartment(user, challan.toDepartment)) {
      return NextResponse.json({ error: 'Only the sending and receiving departments (or an administrator) can see this history.' }, { status: 403 });
    }
    return NextResponse.json({ data: await challanEditHistory(id) });
  } catch (error) {
    return errorResponse(error, 'Failed to load the challan history.');
  }
}
