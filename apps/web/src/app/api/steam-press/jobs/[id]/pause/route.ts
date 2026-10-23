import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STEAM_PRESS');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({
      where: { id },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Steam Press job not found' }, { status: 404 });
    }

    if (challan.status !== 'IN_PROCESS') {
      return NextResponse.json(
        { error: `Job must be in 'IN_PROCESS' status to pause. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    const actorId = authUser.id;

    const reason = body.reason || 'Operator break / Boiler pressure drop / Table maintenance';

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
          notes: `Steam pressing paused: ${reason}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Steam Press job ${updated.challanNumber} paused`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error pausing Steam Press job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to pause Steam Press job' },
      { status: 500 }
    );
  }
}
