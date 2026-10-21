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

    const challan = await prisma.challan.findUnique({
      where: { id },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Steam Press job not found' }, { status: 404 });
    }

    if (challan.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: `Job must be in 'ON_HOLD' status to resume. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    let actorId = body.actorId;
    if (!actorId) {
      const steamPressUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'steampress' }, { username: 'steam_press' }, { departmentCode: 'STEAM_PRESS' }] },
        select: { id: true },
      });
      actorId = steamPressUser?.id;
    }
    if (!actorId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallbackUser?.id;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: 'IN_PROCESS',
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Resumed from hold`,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'PRODUCTION_RESUMED',
          fromStatus: 'ON_HOLD',
          toStatus: 'IN_PROCESS',
          actorId: actorId,
          notes: 'Steam pressing operation resumed on floor.',
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Steam Press job ${updated.challanNumber} resumed`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error resuming Steam Press job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resume Steam Press job' },
      { status: 500 }
    );
  }
}
