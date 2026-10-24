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

    // 1. Fetch Challan
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: true,
        items: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Steam Press job not found' }, { status: 404 });
    }

    if (challan.status !== 'COMPLETED' && challan.status !== 'IN_PROCESS' && challan.status !== 'READY_FOR_HANDOVER') {
      return NextResponse.json(
        { error: `Job must be in 'COMPLETED' or 'IN_PROCESS' status to inspect. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    // 2. Identify inspector
    const actorId = authUser.id;

    const {
      creaseSharpness = 'PASS',
      shineCheck = 'PASS',
      wrinkleFree = 'PASS',
      moistureCheck = 'PASS',
      overallResult = 'PASS',
      notes = '',
    } = body;

    const isPassed =
      overallResult === 'PASS' &&
      creaseSharpness === 'PASS' &&
      shineCheck === 'PASS' &&
      wrinkleFree === 'PASS' &&
      moistureCheck === 'PASS';

    const nextStatus = isPassed ? 'READY_FOR_HANDOVER' : 'ON_HOLD';

    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: nextStatus,
          remarks: `${challan.remarks ? challan.remarks + ' | ' : ''}Pressing Audit: ${isPassed ? 'PASSED' : 'FLAGGED'} (${notes || 'All pressing specs verified'})`,
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
          notes: `Steam Press Appearance Audit: ${isPassed ? 'Passed' : 'Needs attention'} - Crease: ${creaseSharpness}, Shine: ${shineCheck}, Wrinkle-Free: ${wrinkleFree}, Moisture: ${moistureCheck}. ${notes}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Quality audit recorded for job ${updated.challanNumber}. Status: ${nextStatus}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error auditing Steam Press job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record Steam Press quality inspection' },
      { status: 500 }
    );
  }
}
