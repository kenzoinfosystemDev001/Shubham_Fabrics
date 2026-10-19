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
      include: {
        program: true,
        items: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Finishing job not found' }, { status: 404 });
    }

    if (challan.status !== 'COMPLETED' && challan.status !== 'IN_PROCESS' && challan.status !== 'READY_FOR_HANDOVER') {
      return NextResponse.json(
        { error: `Job must be in 'COMPLETED' or 'IN_PROCESS' status to inspect. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    // 2. Identify inspector
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

    const {
      trimmingCleanliness = 'PASS',
      spotCleaning = 'PASS',
      pressingQuality = 'PASS',
      measurementCheck = 'PASS',
      overallResult = 'PASS',
      notes = '',
    } = body;

    const isPassed = overallResult === 'PASS' &&
      trimmingCleanliness === 'PASS' &&
      spotCleaning === 'PASS' &&
      pressingQuality === 'PASS' &&
      measurementCheck === 'PASS';

    const nextStatus = isPassed ? 'READY_FOR_HANDOVER' : 'ON_HOLD';

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: nextStatus,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Finishing QC: ${isPassed ? 'PASSED' : 'FLAGGED'} (${notes || 'All finishing specs verified'})`,
        },
        include: {
          program: true,
          items: true,
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: isPassed ? 'INSPECTION_PASSED' : 'INSPECTION_FAILED',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Finishing Quality Inspection: ${isPassed ? 'Passed' : 'Needs attention'} - Trimming: ${trimmingCleanliness}, Spots/Clean: ${spotCleaning}, Pressing: ${pressingQuality}, Measurements: ${measurementCheck}. ${notes}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Quality inspection recorded for job ${updated.challanNumber}. Status: ${nextStatus}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error inspecting Finishing job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record Finishing quality inspection' },
      { status: 500 }
    );
  }
}
