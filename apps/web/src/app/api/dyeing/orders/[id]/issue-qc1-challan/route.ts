import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import {
  assertChallanNumbersAvailable,
  challanNumberErrorResponse,
  requireChallanNumber,
} from '@/lib/challan-number-server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'DYEING');
  if (!authUser) return authResponse;
  let challanNumber = '';
  try {
    const { id } = await params;
    const body = await request.json();
    challanNumber = requireChallanNumber(body?.challanNumber);

    const order = await prisma.dyeingOrder.findUnique({
      where: { id },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            styleCode: true,
            priority: true,
          },
        },
        inboundChallan: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Dyeing order not found.' }, { status: 404 });
    }

    const {
      quantityToSend,
      color,
      remarks,
      vehicleNumber,
      driverName,
      inchargeId,
    } = body;

    // 1. Backend Validation
    if (!quantityToSend || isNaN(Number(quantityToSend)) || Number(quantityToSend) <= 0) {
      return NextResponse.json(
        { error: 'Quantity to send to QC1 must be a valid positive number.' },
        { status: 400 }
      );
    }

    const qtyToSend = Number(quantityToSend);

    if (order.dyedQuantity <= 0) {
      return NextResponse.json(
        { error: 'Cannot issue Challan to QC1 because 0 quantity has been dyed. Please record dyed quantity first.' },
        { status: 400 }
      );
    }

    const availableDyedForQc = Math.max(0, order.dyedQuantity - order.sentToQc1Quantity);
    if (qtyToSend > availableDyedForQc) {
      return NextResponse.json(
        {
          error: `Cannot send ${qtyToSend} ${order.uom} to QC1. Only ${availableDyedForQc} ${order.uom} of dyed fabric is currently available for dispatch (Dyed: ${order.dyedQuantity}, Already Sent: ${order.sentToQc1Quantity}).`,
        },
        { status: 400 }
      );
    }

    // 2. Resolve Actor ID
    const actorUser = { id: authUser.id, fullName: authUser.fullName, username: authUser.username };
    const actorId = actorUser?.id || '';

    // 3. Ensure DYEING and QC1 exist in Department table
    await prisma.department.upsert({
      where: { code: 'DYEING' },
      update: {},
      create: {
        code: 'DYEING',
        name: 'Dyeing Department',
        sequenceOrder: 2,
        description: 'Fabric Processing & Dyeing Unit',
      },
    });

    await prisma.department.upsert({
      where: { code: 'QC1' },
      update: {},
      create: {
        code: 'QC1',
        name: 'Dyeing Quality Check (QC1)',
        sequenceOrder: 3,
        description: 'Post-Dyeing First Stage Quality Inspection',
      },
    });

    // 4. Challan number is typed by the user; reject numbers already in use.
    await assertChallanNumbersAvailable(prisma, [{ value: challanNumber }]);

    // Colour printed on the challan item. The actual dyed shade (dyedColor) is only taken from
    // what was recorded on the order or explicitly sent by the user, never from the target colour.
    const explicitColor = typeof color === 'string' && color.trim() ? color.trim() : null;
    const effectiveColor = explicitColor || order.dyedColor || order.targetColor || 'Standard';
    const actualDyedColor = order.dyedColor || explicitColor;

    // 5. Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Challan: DYEING -> QC1
      const challan = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: order.programId,
          parentChallanId: order.inboundChallanId || null, // Full genealogy back to Fabric Store Challan!
          fromDepartment: 'DYEING',
          toDepartment: 'QC1',
          status: 'ISSUED',
          priority: order.priority || 'NORMAL',
          createdById: actorId,
          issuedById: actorId,
          issuedDate: new Date(),
          remarks: [
            `Dyeing → Dyeing QC Inspection Dispatch for Sheet ${order.program.programSerialNo || order.program.programNumber}`,
            remarks,
            vehicleNumber ? `Vehicle: ${vehicleNumber}` : null,
            driverName ? `Driver: ${driverName}` : null,
          ]
            .filter(Boolean)
            .join(' | ') || null,
        },
      });

      // Create Challan Item
      const challanItem = await tx.challanItem.create({
        data: {
          challanId: challan.id,
          itemDescription: `${order.fabricName} (${effectiveColor}) - Dyed Lot`,
          fabricCode: order.fabricType || 'KNIT',
          colour: effectiveColor,
          unitType: 'ROLL',
          quantity: qtyToSend,
          uom: order.uom || 'MTR',
          remarks: `Issued by Dyeing Incharge: ${actorUser?.fullName || 'Dyeing Floor'}`,
        },
      });

      // Update DyeingOrder metrics & status
      const updatedSentQty = order.sentToQc1Quantity + qtyToSend;
      const updatedReadyQty = Math.max(0, order.dyedQuantity - updatedSentQty);

      const updatedOrder = await tx.dyeingOrder.update({
        where: { id },
        data: {
          sentToQc1Quantity: updatedSentQty,
          readyForQc1Quantity: updatedReadyQty,
          qc1ChallanId: challan.id,
          sentToQc1At: new Date(),
          status: 'SENT_TO_QC1',
          ...(actualDyedColor ? { dyedColor: actualDyedColor } : {}),
        },
        include: {
          program: true,
          inboundChallan: true,
          qc1Challan: {
            include: { items: true },
          },
        },
      });

      // Log Production Transaction
      await tx.productionTransaction.create({
        data: {
          programId: order.programId,
          challanId: challan.id,
          departmentCode: 'DYEING',
          operationName: 'QC1_DISPATCH',
          operatorId: actorId,
          inputQuantity: qtyToSend,
          goodQuantity: qtyToSend,
          balanceQuantity: updatedReadyQty,
          unitOfMeasure: order.uom || 'MTR',
          notes: `Dispatched ${qtyToSend} ${order.uom} dyed fabric to QC1 on Challan ${challanNumber}`,
        },
      });

      // Log Audit Event
      await tx.auditLog.create({
        data: {
          action: 'DYEING_ISSUE_QC1',
          entity: 'Challan',
          entityId: challan.id,
          actor: {
            connect: { id: actorId },
          },
          afterState: JSON.stringify({
            challanNumber,
            quantityToSend: qtyToSend,
            uom: order.uom,
            orderNumber: order.orderNumber,
          }),
        },
      });

      return {
        challan: {
          ...challan,
          items: [challanItem],
        },
        order: updatedOrder,
      };
    });

    return NextResponse.json({
      message: `Challan ${result.challan.challanNumber} successfully issued to QC1.`,
      data: result,
    });
  } catch (error: any) {
    const numberResponse = challanNumberErrorResponse(error, challanNumber);
    if (numberResponse) return numberResponse;
    console.error('Error issuing Dyeing → QC1 Challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue Challan to QC1.' },
      { status: 500 }
    );
  }
}
