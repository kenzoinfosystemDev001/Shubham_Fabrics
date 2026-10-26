import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC1');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { notes } = body;

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: true,
        items: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found.' }, { status: 404 });
    }

    if (challan.toDepartment !== 'QC1') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to QC1.` },
        { status: 400 }
      );
    }

    if (!['RECEIVED', 'UNDER_INSPECTION'].includes(challan.status)) {
      return NextResponse.json(
        {
          error: `Cannot start inspection on Challan ${challan.challanNumber}. Current status is '${challan.status}'. Must be RECEIVED first.`,
        },
        { status: 400 }
      );
    }

    // Resolve actor
    const actorUser = { id: authUser.id, fullName: authUser.fullName, username: authUser.username };
    const actorId = actorUser?.id || '';

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id },
        data: {
          status: 'UNDER_INSPECTION',
        },
        include: {
          program: true,
          items: true,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: id,
          fromStatus: challan.status,
          toStatus: 'UNDER_INSPECTION',
          action: 'START_INSPECTION',
          actorId,
          notes: notes || `Dyeing QC Inspection initiated by ${actorUser?.fullName || 'Dyeing QC Inspector'}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      message: `Inspection started for Challan ${updated.challanNumber}.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error starting QC1 inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start inspection.' },
      { status: 500 }
    );
  }
}
