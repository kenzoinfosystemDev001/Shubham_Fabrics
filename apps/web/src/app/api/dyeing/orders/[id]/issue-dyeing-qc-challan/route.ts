import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { inactiveDepartmentError } from '@/lib/departments';
import { challanNumberErrorResponse, duplicateChallanNumberResponse, isDuplicateChallanNumberError, validateManualChallanNumber } from '@/lib/challan-number';
import { NOT_SPECIFIED_DYE_COLOR } from '@/lib/dyeing-instructions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

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
        { error: 'Quantity to send to Dyeing QC must be a valid positive number.' },
        { status: 400 }
      );
    }

    const qtyToSend = Number(quantityToSend);

    if (order.dyedQuantity <= 0) {
      return NextResponse.json(
        { error: 'Cannot issue Challan to Dyeing QC because 0 quantity has been dyed. Please record dyed quantity first.' },
        { status: 400 }
      );
    }

    const availableDyedForQc = Math.max(0, order.dyedQuantity - order.sentToDyeingQcQuantity);
    if (qtyToSend > availableDyedForQc) {
      return NextResponse.json(
        {
          error: `Cannot send ${qtyToSend} ${order.uom} to Dyeing QC. Only ${availableDyedForQc} ${order.uom} of dyed fabric is currently available for dispatch (Dyed: ${order.dyedQuantity}, Already Sent: ${order.sentToDyeingQcQuantity}).`,
        },
        { status: 400 }
      );
    }

    // 2. Resolve Actor ID
    let actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: inchargeId || order.inchargeId || '' },
          { username: 'dyeing' },
          { departmentCode: 'DYEING' },
          { username: 'admin' },
        ],
      },
      select: { id: true, fullName: true, username: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true, fullName: true, username: true } });
    }
    const actorId = actorUser?.id || '';

    // 3. Ensure DYEING and Dyeing QC exist in Department table
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
      where: { code: 'DYEING_QC' },
      update: {},
      create: {
        code: 'DYEING_QC',
        name: 'Dyeing Quality Check (Dyeing QC)',
        sequenceOrder: 3,
        description: 'Post-Dyeing First Stage Quality Inspection',
      },
    });

    // 4. Challan number is entered manually by the Dyeing department.
    const numberCheck = await validateManualChallanNumber(body.challanNumber);
    if (!numberCheck.ok) return challanNumberErrorResponse(numberCheck);
    const challanNumber = numberCheck.challanNumber;
    const departmentBlocked = await inactiveDepartmentError(prisma, ['DYEING', 'DYEING_QC']);
    if (departmentBlocked) return NextResponse.json({ error: departmentBlocked }, { status: 409 });

    const effectiveColor = color || order.dyedColor || order.targetColor || 'Standard';

    // 5. Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Challan: DYEING -> Dyeing QC
      const challan = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: order.programId,
          parentChallanId: order.inboundChallanId || null, // Full genealogy back to Fabric Store Challan!
          fromDepartment: 'DYEING',
          toDepartment: 'DYEING_QC',
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
          // Keep the original instruction next to the actual result for Dyeing QC.
          shade: color || order.dyedColor || null,
          requiredDyeColor: order.targetColor && order.targetColor !== NOT_SPECIFIED_DYE_COLOR ? order.targetColor : null,
          unitType: 'ROLL',
          quantity: qtyToSend,
          uom: order.uom || 'MTR',
          remarks: `Issued by Dyeing Incharge: ${actorUser?.fullName || 'Dyeing Floor'}`,
        },
      });

      // Update DyeingOrder metrics & status
      const updatedSentQty = order.sentToDyeingQcQuantity + qtyToSend;
      const updatedReadyQty = Math.max(0, order.dyedQuantity - updatedSentQty);

      const updatedOrder = await tx.dyeingOrder.update({
        where: { id },
        data: {
          sentToDyeingQcQuantity: updatedSentQty,
          readyForDyeingQcQuantity: updatedReadyQty,
          dyeingQcChallanId: challan.id,
          sentToDyeingQcAt: new Date(),
          status: 'SENT_TO_DYEING_QC',
          dyedColor: order.dyedColor || effectiveColor,
        },
        include: {
          program: true,
          inboundChallan: true,
          dyeingQcChallan: {
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
          operationName: 'DYEING_QC_DISPATCH',
          operatorId: actorId,
          inputQuantity: qtyToSend,
          goodQuantity: qtyToSend,
          balanceQuantity: updatedReadyQty,
          unitOfMeasure: order.uom || 'MTR',
          notes: `Dispatched ${qtyToSend} ${order.uom} dyed fabric to Dyeing QC on Challan ${challanNumber}`,
        },
      });

      // Log Audit Event
      await tx.auditLog.create({
        data: {
          action: 'DYEING_ISSUE_DYEING_QC',
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
      message: `Challan ${result.challan.challanNumber} successfully issued to Dyeing QC.`,
      data: result,
    });
  } catch (error: any) {
    if (isDuplicateChallanNumberError(error)) {
      return duplicateChallanNumberResponse();
    }
    console.error('Error issuing Dyeing → Dyeing QC Challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue Challan to Dyeing QC.' },
      { status: 500 }
    );
  }
}
