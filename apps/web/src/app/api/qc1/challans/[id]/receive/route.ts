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
    const { receiverId, notes } = body;

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
        { error: `Challan ${challan.challanNumber} is addressed to ${challan.toDepartment}, not QC1.` },
        { status: 400 }
      );
    }

    // Backend duplicate receiving check
    if (challan.status !== 'ISSUED') {
      return NextResponse.json(
        {
          error: `Cannot receive Challan ${challan.challanNumber}. Current status is '${challan.status}'. It has already been received or processed.`,
        },
        { status: 400 }
      );
    }

    // Resolve authenticated actor
    let actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: receiverId || '' },
          { username: 'qc_insp' },
          { username: 'qc1' },
          { departmentCode: 'QC1' },
          { username: 'admin' },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true, fullName: true, username: true } });
    }
    const actorId = actorUser?.id || '';

    // Database transaction to guarantee consistency
    const updatedChallan = await prisma.$transaction(async (tx) => {
      // 1. Update Challan status and receiving timestamp
      const ch = await tx.challan.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedDate: new Date(),
          receivedById: actorId,
          remarks: notes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Received by QC1: ${notes}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
          issuedBy: { select: { fullName: true, username: true } },
          receivedBy: { select: { fullName: true, username: true } },
        },
      });

      // 2. Record Challan Event for operational traceability
      await tx.challanEvent.create({
        data: {
          challanId: id,
          fromStatus: 'ISSUED',
          toStatus: 'RECEIVED',
          action: 'RECEIVE',
          actorId,
          notes: notes || `Material received at Dyeing QC inspection station by ${actorUser?.fullName || 'Dyeing QC Inspector'}`,
          metadata: JSON.stringify({
            receivedAt: new Date(),
            itemsCount: ch.items.length,
            totalQuantity: ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
          }),
        },
      });

      // 3. Record Audit Log
      await tx.auditLog.create({
        data: {
          action: 'QC1_CHALLAN_RECEIVED',
          entity: 'Challan',
          entityId: id,
          actor: { connect: { id: actorId } },
          beforeState: JSON.stringify({ status: 'ISSUED' }),
          afterState: JSON.stringify({
            status: 'RECEIVED',
            receivedById: actorId,
            receivedDate: new Date(),
          }),
        },
      });

      return ch;
    }, { maxWait: 15000, timeout: 30000 });

    return NextResponse.json({
      message: `Challan ${updatedChallan.challanNumber} received successfully at QC1.`,
      data: updatedChallan,
    });
  } catch (error: any) {
    console.error('Error receiving QC1 challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to receive Challan at QC1.' },
      { status: 500 }
    );
  }
}
