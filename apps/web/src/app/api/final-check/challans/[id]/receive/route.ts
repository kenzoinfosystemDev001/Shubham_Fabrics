import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

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

    let actorId = body.actorId;
    if (!actorId) {
      const fcUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: 'finalcheck' },
            { username: 'final_check' },
            { departmentCode: 'FINAL_CHECK' },
          ],
        },
        select: { id: true },
      });
      actorId = fcUser?.id;
    }
    if (!actorId) {
      const fallback = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallback?.id;
    }

    const totalIssuedQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const receivedQuantity = body.receivedQuantity !== undefined ? Number(body.receivedQuantity) : totalIssuedQty;

    if (!Number.isInteger(receivedQuantity) || receivedQuantity <= 0) {
      return NextResponse.json({ error: 'Received garment piece count must be a positive whole number.' }, { status: 400 });
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
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: nextStatus,
          receivedDate: new Date(),
          receivedById: actorId,
          fabricIn: receivedQuantity,
          remarks: body.remarks
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Final QC Receipt: ${body.remarks}`
            : challan.remarks,
        },
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
