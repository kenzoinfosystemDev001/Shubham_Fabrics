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
    const { inspectorId, notes } = body;

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

    if (challan.toDepartment !== 'THREADCUT_QC') {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is not routed to Threadcut QC.` },
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
    let actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: inspectorId || '' },
          { username: 'qc2' },
          { username: 'qc2_insp' },
          { departmentCode: 'THREADCUT_QC' },
          { username: 'admin' },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true, fullName: true, username: true } });
    }
    const actorId = actorUser?.id || '';

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.challan.update({
        where: { id },
        data: {
          status: 'UNDER_INSPECTION',
          remarks: notes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Inspection started at Threadcut QC: ${notes}`
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
          notes: notes || `Quality inspection commenced on Challan ${challan.challanNumber} at Threadcut QC Terminal.`,
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
    console.error('Error starting Threadcut QC inspection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start Threadcut QC inspection' },
      { status: 500 }
    );
  }
}
