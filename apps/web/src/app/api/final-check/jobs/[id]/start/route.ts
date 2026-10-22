import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalCheckActor } from '@/lib/final-check-auth';

export const dynamic = 'force-dynamic';
const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getFinalCheckActor(request);
    if (!auth.actor) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { items: true, program: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Final QC job not found' }, { status: 404 });
    }

    if (!FINAL_CHECK_DEPTS.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json({ error: 'This challan is not routed to Final QC.' }, { status: 400 });
    }

    if (challan.status !== 'RECEIVED') {
      return NextResponse.json(
        { error: `Job must be in 'RECEIVED' status to start. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    const actorId = auth.actor.id;

    const tableNumber = body.tableNumber || body.workstationNumber || 'Inspection Table 1';
    const inspectorName = body.inspectorName || body.operatorName || 'Final QC Inspector';

    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.challan.updateMany({
        where: { id: challan.id, status: 'RECEIVED' },
        data: {
          status: 'IN_PROCESS',
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Table: ${tableNumber}, Inspector: ${inspectorName}`,
        },
      });
      if (claim.count !== 1) return null;

      const ch = await tx.challan.findUniqueOrThrow({
        where: { id: challan.id },
        include: { program: true, items: true },
      });

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'PRODUCTION_STARTED',
          fromStatus: challan.status,
          toStatus: 'IN_PROCESS',
          actorId: actorId,
          notes: `Final QC inspection started at ${tableNumber} by ${inspectorName}.`,
        },
      });

      return ch;
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'This job was changed by another user. Refresh and try again.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Final QC inspection started for job ${updated.challanNumber}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error starting Final QC job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start Final QC job' },
      { status: 500 }
    );
  }
}
