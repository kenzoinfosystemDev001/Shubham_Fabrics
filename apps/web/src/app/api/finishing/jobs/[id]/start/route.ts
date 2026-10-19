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

    // 1. Fetch Challan
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { items: true, program: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Finishing job not found' }, { status: 404 });
    }

    if (challan.status !== 'RECEIVED' && challan.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: `Job must be in 'RECEIVED' or 'ON_HOLD' status to start. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    // 2. Identify actor
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

    const workstationNumber = body.workstationNumber || body.tableNumber || 'Station 1';
    const operatorName = body.operatorName || 'Finishing Specialist';
    const operationType = body.operationType || 'THREAD_TRIMMING_AND_CLEANING';

    // 3. Atomically update Challan to IN_PROCESS
    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: 'IN_PROCESS',
          remarks: body.remarks
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Station: ${workstationNumber}, Op: ${operatorName}, Operation: ${operationType}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'PRODUCTION_STARTED',
          fromStatus: challan.status,
          toStatus: 'IN_PROCESS',
          actorId: actorId,
          notes: `Finishing started at ${workstationNumber} by ${operatorName} (${operationType}).`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Job ${updated.challanNumber} started successfully`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error starting Finishing job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start Finishing job' },
      { status: 500 }
    );
  }
}
