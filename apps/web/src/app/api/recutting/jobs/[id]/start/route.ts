import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'RECUTTING');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { program: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (challan.status !== 'RECEIVED' && challan.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: `Job cannot be started from '${challan.status}' status. It must be in 'RECEIVED' status.` },
        { status: 400 }
      );
    }

    const actorId = authUser.id;

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id },
        data: {
          status: 'IN_PROCESS',
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: id,
          action: 'PRODUCTION_STARTED',
          fromStatus: challan.status,
          toStatus: 'IN_PROCESS',
          actorId: actorId,
          notes: body.notes || 'Precision embroidery recutting operation commenced at cutting workstation.',
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Recutting operation started for job ${updated.challanNumber}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error starting Recutting job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start recutting job' },
      { status: 500 }
    );
  }
}
