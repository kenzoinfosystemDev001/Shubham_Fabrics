import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { receiverId, notes } = body;

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    const totalQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

    let actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: receiverId || '' },
          { username: 'washing' },
          { username: 'admin' },
        ],
      },
      select: { id: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true } });
    }

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
