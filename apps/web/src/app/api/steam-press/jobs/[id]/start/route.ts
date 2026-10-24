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
      include: { items: true, program: true },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Steam Press job not found' }, { status: 404 });
    }

    if (challan.status !== 'RECEIVED' && challan.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: `Job must be in 'RECEIVED' or 'ON_HOLD' status to start. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    // 2. Identify actor
    const actorId = authUser.id;

    const workstationNumber = body.workstationNumber || body.tableNumber || 'Table 1';
    const operatorName = body.operatorName || 'Steam Press Operator';
    const operationType = body.operationType || 'BOILER_STEAM_PRESSING';

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
          notes: `Steam pressing started at ${workstationNumber} by ${operatorName} (${operationType}).`,
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
    console.error('Error starting Steam Press job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start Steam Press job' },
      { status: 500 }
    );
  }
}
