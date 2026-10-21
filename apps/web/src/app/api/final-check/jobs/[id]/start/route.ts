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
      include: { items: true, program: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Final QC job not found' }, { status: 404 });
    }

    if (challan.status !== 'RECEIVED' && challan.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: `Job must be in 'RECEIVED' or 'ON_HOLD' status to start. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    let actorId = body.actorId;
    if (!actorId) {
      const fcUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'finalcheck' }, { username: 'final_check' }, { departmentCode: 'FINAL_CHECK' }] },
        select: { id: true },
      });
      actorId = fcUser?.id;
    }
    if (!actorId) {
      const fallback = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallback?.id;
    }

    const tableNumber = body.tableNumber || body.workstationNumber || 'Inspection Table 1';
    const inspectorName = body.inspectorName || body.operatorName || 'Final QC Inspector';

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: 'IN_PROCESS',
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Table: ${tableNumber}, Inspector: ${inspectorName}`,
        },
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
