import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getPackingActor } from '@/lib/packing-auth';
import { parseWholeNumber } from '@/lib/packing-rules';

export const dynamic = 'force-dynamic';

const PACKING_DEPTS = ['PACKING', 'PACK', 'FOLDING'];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPackingActor(request);
    if (!auth.actor) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 1. Fetch Challan
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        items: true,
        program: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    if (!PACKING_DEPTS.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `This Challan is designated for '${challan.toDepartment}', not Packing Department.` },
        { status: 400 }
      );
    }

    if (challan.status !== 'ISSUED') {
      return NextResponse.json(
        { error: `Only an ISSUED challan can be received. Current status: '${challan.status}'.` },
        { status: 400 }
      );
    }

    const actorId = auth.actor.id;

    // 2. Validate piece quantities
    let totalIssuedQty: number;
    let receivedQuantity: number;

    try {
      totalIssuedQty = challan.items.reduce(
        (sum, item) => sum + parseWholeNumber(item.quantity, 'Issued garment quantity'),
        0
      );
      receivedQuantity =
        body.receivedQuantity !== undefined
          ? parseWholeNumber(body.receivedQuantity, 'Received piece count')
          : totalIssuedQty;
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Invalid garment piece counts.' }, { status: 400 });
    }

    if (receivedQuantity <= 0 || totalIssuedQty <= 0) {
      return NextResponse.json({ error: 'Issued and received garment counts must be positive integers.' }, { status: 400 });
    }

    if (receivedQuantity > totalIssuedQty) {
      return NextResponse.json(
        { error: `Received quantity (${receivedQuantity}) cannot exceed total issued quantity (${totalIssuedQty}).` },
        { status: 400 }
      );
    }

    const hasShortage = receivedQuantity < totalIssuedQty;
    const nextStatus = hasShortage && body.markOnHold ? 'ON_HOLD' : 'RECEIVED';

    // 3. Atomically update Challan & write Audit Event
    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.challan.updateMany({
        where: { id: challan.id, status: 'ISSUED' },
        data: {
          status: nextStatus,
          receivedDate: new Date(),
          receivedById: actorId,
          fabricIn: receivedQuantity,
          remarks: body.remarks
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Packing Inward: ${body.remarks}`
            : challan.remarks,
        },
      });

      if (claim.count !== 1) {
        throw new Error('Challan status changed concurrently. Please refresh.');
      }

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'CHALLAN_RECEIVED',
          fromStatus: 'ISSUED',
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Packing Department acknowledged receipt: ${receivedQuantity}/${totalIssuedQty} garments verified.${
            hasShortage ? ` Shortage noted: ${totalIssuedQty - receivedQuantity} missing pieces.` : ''
          } ${body.remarks || ''}`,
        },
      });

      return tx.challan.findUnique({
        where: { id: challan.id },
        include: {
          program: true,
          items: true,
          receivedBy: { select: { fullName: true, username: true } },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${updated?.challanNumber} received successfully into Packing`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error receiving Packing challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to receive Challan into Packing' },
      { status: 500 }
    );
  }
}
