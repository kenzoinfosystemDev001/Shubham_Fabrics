import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STITCHING');
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 1. Fetch Challan
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: { items: true, program: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Stitching job not found' }, { status: 404 });
    }

    if (challan.status !== 'RECEIVED' && challan.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: `Job must be in 'RECEIVED' or 'ON_HOLD' status to start. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    // 2. Identify actor
    const actorId = authUser.id;

    const lineNumber = body.lineNumber || 'Line 1';
    const machineNumber = body.machineNumber || 'M-01';
    const operatorName = body.operatorName || 'Stitching Operator';

    // 3. Atomically update Challan to IN_PROCESS
    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: 'IN_PROCESS',
          remarks: body.remarks
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Line: ${lineNumber}, Machine: ${machineNumber}, Op: ${operatorName}`
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
          notes: `Stitching initiated on ${lineNumber} (${machineNumber}) by ${operatorName}.`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Stitching job ${updated.challanNumber} started on ${lineNumber}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error starting Stitching job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start stitching job' },
      { status: 500 }
    );
  }
}
