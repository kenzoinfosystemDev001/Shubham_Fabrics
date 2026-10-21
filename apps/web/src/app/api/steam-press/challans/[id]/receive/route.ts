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
        items: true,
        program: true,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    const validTargetDepts = ['STEAM_PRESS', 'STEAM_PRESSING', 'PRESSING'];
    if (!validTargetDepts.includes(challan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: `This Challan is designated for '${challan.toDepartment}', not Steam Press Department.` },
        { status: 400 }
      );
    }

    if (challan.status === 'RECEIVED' || challan.status === 'IN_PROCESS' || challan.status === 'COMPLETED') {
      return NextResponse.json(
        { error: `Challan is already in '${challan.status}' status. Duplicate receipt rejected.` },
        { status: 400 }
      );
    }

    // 2. Identify receiving operator / supervisor
    let actorId = body.actorId;
    if (!actorId) {
      const steamPressUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: 'steampress' },
            { username: 'steam_press' },
            { departmentCode: 'STEAM_PRESS' },
          ],
        },
        select: { id: true },
      });
      actorId = steamPressUser?.id;
    }

    if (!actorId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallbackUser?.id;
    }

    // 3. Compute items and quantities
    const totalIssuedQty = challan.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    const receivedQuantity = body.receivedQuantity !== undefined ? Number(body.receivedQuantity) : totalIssuedQty;

    if (isNaN(receivedQuantity) || receivedQuantity <= 0) {
      return NextResponse.json(
        { error: 'Valid received garment piece count is required.' },
        { status: 400 }
      );
    }

    if (receivedQuantity > totalIssuedQty) {
      return NextResponse.json(
        { error: `Received quantity (${receivedQuantity}) cannot exceed total issued quantity (${totalIssuedQty}).` },
        { status: 400 }
      );
    }

    const hasShortage = receivedQuantity < totalIssuedQty;
    const isHoldRequested = Boolean(body.onHold) || hasShortage;
    const nextStatus = isHoldRequested && body.markOnHold ? 'ON_HOLD' : 'RECEIVED';

    // 4. Update Challan atomically
    const updated = await prisma.$transaction(async (tx) => {
      const ch = await tx.challan.update({
        where: { id: challan.id },
        data: {
          status: nextStatus,
          receivedDate: new Date(),
          receivedById: actorId,
          fabricIn: receivedQuantity,
          remarks: body.remarks
            ? `${challan.remarks ? challan.remarks + ' | ' : ''}Steam Press Receipt: ${body.remarks}`
            : challan.remarks,
        },
        include: {
          program: true,
          items: true,
          receivedBy: { select: { fullName: true, username: true } },
        },
      });

      // Create tracking audit event
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          action: 'CHALLAN_RECEIVED',
          fromStatus: challan.status,
          toStatus: nextStatus,
          actorId: actorId,
          notes: `Steam Press Department acknowledged receipt: ${receivedQuantity}/${totalIssuedQty} garments verified.${
            hasShortage ? ` Discrepancy/Shortage detected: ${totalIssuedQty - receivedQuantity} pieces missing.` : ''
          } ${body.remarks || ''}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${updated.challanNumber} received successfully into Steam Press`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error receiving Steam Press challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to receive Challan into Steam Press' },
      { status: 500 }
    );
  }
}
