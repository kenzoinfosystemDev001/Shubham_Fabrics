import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'PROGRAMMING');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const updated = await prisma.program.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating program status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update program status' }, { status: 500 });
  }
}
