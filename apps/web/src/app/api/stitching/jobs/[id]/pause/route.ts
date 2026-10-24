import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STITCHING');
  if (!authUser) return authResponse;
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

    const actorId = authUser.id;

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
