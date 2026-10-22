import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getFinalCheckActor } from '@/lib/final-check-auth';
import { parseWholeNumber } from '@/lib/final-check-rules.mjs';

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
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    if (!FINAL_CHECK_DEPTS.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `This Challan is designated for '${challan.toDepartment}', not Final QC Department.` },
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

    let totalIssuedQty: number;
    let receivedQuantity: number;
    try {
      totalIssuedQty = challan.items.reduce(
        (sum, item) => sum + parseWholeNumber(item.quantity, 'Issued garment quantity'),
        0,
      );
      receivedQuantity = body.receivedQuantity !== undefined
        ? parseWholeNumber(body.receivedQuantity, 'Received garment piece count')
        : totalIssuedQty;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Garment quantities are invalid.' },
        { status: 400 },
      );
    }

    if (receivedQuantity <= 0 || totalIssuedQty <= 0 || !Number.isSafeInteger(totalIssuedQty)) {
      return NextResponse.json({ error: 'Issued and received garment counts must be positive whole numbers.' }, { status: 400 });
    }

    if (receivedQuantity > totalIssuedQty) {
      return NextResponse.json(
        { error: `Received quantity (${receivedQuantity}) cannot exceed total issued quantity (${totalIssuedQty}).` },
        { status: 400 }
      );
    }

    const hasShortage = receivedQuantity < totalIssuedQty;
    const nextStatus = (body.markOnHold && hasShortage) ? 'ON_HOLD' : 'RECEIVED';

    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.challan.updateMany({
        where: { id: challan.id, status: 'ISSUED' },
        data: {
          status: nextStatus,
          receivedDate: new Date(),
          receivedById: actorId,
          fabricIn: receivedQuantity,
          remarks: body.remarks
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Final QC Receipt: ${body.remarks}`
            : challan.remarks,
        },
      });
      if (claim.count !== 1) return null;

      const ch = await tx.challan.findUniqueOrThrow({
        where: { id: challan.id },
        include: {
          program: true,
          items: true,
          receivedBy: { select: { fullName: true, username: true } },
        },
      });

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'CHALLAN_RECEIVED',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Final QC Department acknowledged receipt: ${receivedQuantity}/${totalIssuedQty} garments verified.${
            hasShortage ? ` Discrepancy/Shortage detected: ${totalIssuedQty - receivedQuantity} pieces missing.` : ''
          } ${body.remarks || ''}`,
        },
      });

      return ch;
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'This challan was received or changed by another user. Refresh and try again.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Challan ${updated.challanNumber} received successfully into Final QC`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error receiving Final QC challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to receive Challan into Final QC' },
      { status: 500 }
    );
  }
}
