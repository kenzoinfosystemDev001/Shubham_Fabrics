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
      return NextResponse.json({ error: 'Finishing job not found' }, { status: 404 });
    }

    if (challan.status !== 'IN_PROCESS') {
      return NextResponse.json(
        { error: `Job must be in 'IN_PROCESS' status to pause. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    let actorId = body.actorId;
    if (!actorId) {
      const finishingUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'finishing' }, { departmentCode: 'FINISHING' }] },
        select: { id: true },
      });
      actorId = finishingUser?.id;
    }
    if (!actorId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallbackUser?.id;
    }

    const reason = body.reason || 'Operator break / Blade replacement / Stain solvent drying';

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
          notes: `Finishing paused: ${reason}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Finishing job ${updated.challanNumber} paused`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error pausing Finishing job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to pause Finishing job' },
      { status: 500 }
    );
  }
}
