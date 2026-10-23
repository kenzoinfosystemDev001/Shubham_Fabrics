import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'QC3');
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

    const validDepts = ['QC3', 'QCWASHING', 'QC_WASHING', 'WASHING_QC', 'QC WASHING'];
    if (!validDepts.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to QC Washing.` },
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
      const c = await tx.challan.update({
        where: { id },
        data: {
          status: 'UNDER_INSPECTION',
          remarks: notes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Inspection started at QC Washing: ${notes}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: id,
          action: 'START',
          fromStatus: challan.status,
          toStatus: 'UNDER_INSPECTION',
          notes: notes || `Quality inspection commenced on Challan ${challan.challanNumber} at QC Washing Terminal.`,
          actorId: actorId,
        },
      });

      return c;
    });

    return NextResponse.json({
      success: true,
      message: `Inspection started for Challan ${updated.challanNumber}.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error starting QC Washing inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start QC Washing inspection' },
      { status: 500 }
    );
  }
}
