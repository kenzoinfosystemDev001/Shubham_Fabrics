import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { parentChallanId, programId, priority, remarks, items, actorId: customActorId } = body;

    if (!parentChallanId) {
      return NextResponse.json({ error: 'Parent Recutting Challan ID is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required for the handover Challan.' }, { status: 400 });
    }

    // 1. Fetch Parent Challan
    const parentChallan = await prisma.challan.findUnique({
      where: { id: parentChallanId },
      include: {
        program: true,
        childChallans: {
          where: { toDepartment: 'STITCHING' },
          include: { items: true },
        },
      },
    });

    if (!parentChallan) {
      return NextResponse.json({ error: 'Parent Challan not found.' }, { status: 404 });
    }

    // 2. Compute available good balance to prevent over-issuance
    const totalGoodProduced = parentChallan.fabricOut ?? parentChallan.fabricIn ?? 0;
    const previouslyHandedOver = parentChallan.childChallans.reduce(
      (sum, ch) => sum + ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      0
    );
    const availableToHandover = Math.max(0, totalGoodProduced - previouslyHandedOver);

    const requestingQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    if (requestingQty <= 0) {
      return NextResponse.json({ error: 'Challan item quantity must be greater than zero.' }, { status: 400 });
    }

    if (totalGoodProduced > 0 && requestingQty > availableToHandover) {
      return NextResponse.json(
        {
          error: `Cannot issue ${requestingQty} pieces. Available unissued good balance is only ${availableToHandover} pieces (Total good: ${totalGoodProduced}, Previously issued: ${previouslyHandedOver}).`,
        },
        { status: 400 }
      );
    }

    // 3. Resolve user identity
    let actorId = customActorId;
    if (!actorId) {
      const recUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'recutting' }, { departmentCode: 'RECUTTING' }] },
        select: { id: true },
      });
      actorId = recUser?.id;
    }
    if (!actorId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallbackUser?.id;
    }

    // 4. Generate unique sequential Challan Number
    const count = await prisma.challan.count({
      where: { fromDepartment: 'RECUTTING' },
    });
    const timestamp = Date.now().toString().slice(-4);
    const challanNumber = `CH-RC-${String(count + 1).padStart(4, '0')}-${timestamp}`;

    // 5. ATOMIC DATABASE TRANSACTION
    const newChallan = await prisma.$transaction(async (tx) => {
      // Create outgoing Challan to Stitching
      const ch = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: programId || parentChallan.programId,
          parentChallanId: parentChallan.id,
          fromDepartment: 'RECUTTING',
          toDepartment: 'STITCHING',
          status: 'ISSUED',
          priority: priority || parentChallan.priority || 'NORMAL',
          issuedDate: new Date(),
          createdById: actorId,
          issuedById: actorId,
          remarks: remarks || `Handover from Recutting to Stitching: Verified precision-cut embroidered pieces.`,
          fabricIn: requestingQty,
          fabricOut: requestingQty,
          items: {
            create: items.map((it: any) => ({
              itemDescription: it.itemDescription || `${parentChallan.program?.styleCode || 'Embroidered'} Cut Panels - Ready for Stitching`,
              fabricCode: it.fabricCode || 'PANEL',
              colour: it.colour || parentChallan.program?.fabricColor || 'Standard',
              quantity: Number(it.quantity),
              uom: it.uom || 'PCS',
              unitType: it.unitType || 'PCS',
              barcode: it.barcode || `BC-RC-${Date.now().toString().slice(-6)}`,
              remarks: it.remarks || 'Precision cut and verified for assembly',
            })),
          },
        },
        include: {
          program: true,
          items: true,
          issuedBy: { select: { fullName: true, username: true } },
          parentChallan: true,
        },
      });

      // Update parent challan status
      const isFullyHandedOver = requestingQty >= availableToHandover;
      await tx.challan.update({
        where: { id: parentChallan.id },
        data: {
          status: isFullyHandedOver ? 'HANDED_OVER' : 'IN_PROCESS',
        },
      });

      // Log event
      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_ISSUED',
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          actorId: actorId,
          notes: `Challan ${challanNumber} issued to Stitching for ${requestingQty} pieces. Parent: ${parentChallan.challanNumber}`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${newChallan.challanNumber} issued to Stitching successfully`,
      data: newChallan,
    });
  } catch (error: any) {
    console.error('Error issuing Challan to Stitching:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue challan to Stitching' },
      { status: 500 }
    );
  }
}
