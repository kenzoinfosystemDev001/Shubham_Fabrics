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
      return NextResponse.json({ error: 'Stitching job not found' }, { status: 404 });
    }

    if (challan.status !== 'IN_PROCESS') {
      return NextResponse.json(
        { error: `Job must be in 'IN_PROCESS' status to pause. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    let actorId = body.actorId;
    if (!actorId) {
      const stitchUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'stitching' }, { departmentCode: 'STITCHING' }] },
        select: { id: true },
      });
      actorId = stitchUser?.id;
    }
    if (!actorId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallbackUser?.id;
    }

    const reason = body.reason || 'Operator break / Thread breakage / Needle change';

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: 'ON_HOLD',
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Paused: ${reason}`,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'PRODUCTION_PAUSED',
          fromStatus: 'IN_PROCESS',
          toStatus: 'ON_HOLD',
          actorId: actorId,
          notes: `Stitching paused: ${reason}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Job ${updated.challanNumber} paused`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error pausing Stitching job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to pause job' },
      { status: 500 }
    );
  }
}
