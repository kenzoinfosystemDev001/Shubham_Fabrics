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

    const validDepts = ['WASHING_QC'];
    if (!validDepts.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `Challan ${challan.challanNumber} is addressed to ${challan.toDepartment}, not Washing QC.` },
        { status: 400 }
      );
    }

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
          { username: 'qcwashing' },
          { username: 'qc3' },
          { departmentCode: 'WASHING_QC' },
          { username: 'admin' },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });

    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true, fullName: true, username: true } });
    }
    const actorId = actorUser?.id || '';

    const totalQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const uom = challan.items[0]?.uom || 'PCS';

    // Atomic update
    const updatedChallan = await prisma.$transaction(async (tx) => {
      const updated = await tx.challan.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedById: actorId,
          receivedDate: new Date(),
          remarks: notes
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Received at Washing QC: ${notes}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
          issuedBy: { select: { fullName: true, username: true } },
          receivedBy: { select: { fullName: true, username: true } },
        },
      });

      // Record audit event
      await tx.challanEvent.create({
        data: {
          challanId: id,
          action: 'RECEIVED',
          fromStatus: 'ISSUED',
          toStatus: 'RECEIVED',
          notes: notes || `Challan acknowledged & physical handover accepted at Washing QC. Total: ${totalQty} ${uom}`,
          actorId: actorId,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${updatedChallan.challanNumber} received successfully at Washing QC!`,
      data: updatedChallan,
    });
  } catch (error: any) {
    console.error('Error receiving Washing QC challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to receive challan at Washing QC' },
      { status: 500 }
    );
  }
}
