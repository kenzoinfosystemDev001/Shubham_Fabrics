import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'WASHING');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body;

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    const totalQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

    const actorUser = { id: authUser.id, fullName: authUser.fullName, username: authUser.username };

    const updated = await prisma.challan.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedDate: new Date(),
        receivedById: actorUser?.id,
        fabricIn: challan.fabricIn || totalQty,
        fabricUnit: 'PCS',
        events: actorUser?.id
          ? {
              create: {
                action: 'RECEIVE',
                fromStatus: challan.status,
                toStatus: 'RECEIVED',
                actorId: actorUser.id,
                notes: notes || 'Lot received into Washing Department. Ready for washer loading.',
              },
            }
          : undefined,
      },
      include: {
        items: true,
        program: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error receiving challan at Washing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to receive challan' },
      { status: 500 }
    );
  }
}
