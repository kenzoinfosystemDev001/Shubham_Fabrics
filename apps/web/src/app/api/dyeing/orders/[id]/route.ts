import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

// GET /api/dyeing/orders/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await prisma.dyeingOrder.findUnique({
      where: { id },
      include: {
        program: {
          include: {
            fabrics: true,
            colours: true,
            specifications: true,
            bomItems: true,
            createdBy: { select: { fullName: true, username: true } },
            approvedBy: { select: { fullName: true, username: true } },
          },
        },
        inboundChallan: {
          include: {
            items: true,
            createdBy: { select: { fullName: true, username: true } },
            issuedBy: { select: { fullName: true, username: true } },
          },
        },
        qc1Challan: {
          include: {
            items: true,
            issuedBy: { select: { fullName: true, username: true } },
          },
        },
        incharge: {
          select: { id: true, fullName: true, username: true, email: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Dyeing order not found.' }, { status: 404 });
    }

    // Also fetch production logs
    const productionLogs = await prisma.productionTransaction.findMany({
      where: {
        programId: order.programId,
        departmentCode: 'DYEING',
      },
      include: {
        operator: { select: { fullName: true, username: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });

    return NextResponse.json({ data: { ...order, productionLogs } });
  } catch (error: any) {
    console.error('Error fetching dyeing order details:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dyeing order' }, { status: 500 });
  }
}

// PATCH /api/dyeing/orders/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingOrder = await prisma.dyeingOrder.findUnique({
      where: { id },
      include: { program: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Dyeing order not found.' }, { status: 404 });
    }

    const {
      dyedQuantity,
      dyedColor,
      colorCode,
      status: requestedStatus,
      inchargeId,
      inchargeName,
      batchNumber,
      machineNumber,
      processRemarks,
    } = body;

    // Validate dyed quantity
    let newDyedQty = existingOrder.dyedQuantity;
    if (dyedQuantity !== undefined && dyedQuantity !== null && dyedQuantity !== '') {
      const parsed = Number(dyedQuantity);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'Dyed quantity must be a non-negative number.' }, { status: 400 });
      }
      newDyedQty = parsed;
    }

    // Calculate undyed remaining and ready for QC1
    const newUndyedQty = Math.max(0, existingOrder.requiredQuantity - newDyedQty);
    const newReadyForQc1Qty = Math.max(0, newDyedQty - existingOrder.sentToQc1Quantity);

    // Compute automatic status if not explicitly requested
    let finalStatus = requestedStatus;
    if (!finalStatus) {
      if (existingOrder.status === 'SENT_TO_QC1' && newReadyForQc1Qty === 0) {
        finalStatus = 'SENT_TO_QC1';
      } else if (newDyedQty >= existingOrder.requiredQuantity) {
        finalStatus = 'DYED';
      } else if (newDyedQty > 0) {
        finalStatus = 'PARTIALLY_DYED';
      } else {
        finalStatus = 'IN_DYEING';
      }
    }

    // Resolve Incharge
    let resolvedInchargeId = inchargeId || existingOrder.inchargeId;
    let resolvedInchargeName = inchargeName || existingOrder.inchargeName;

    if (inchargeId) {
      const user = await prisma.user.findUnique({
        where: { id: inchargeId },
        select: { id: true, fullName: true, username: true },
      });
      if (user) {
        resolvedInchargeId = user.id;
        resolvedInchargeName = user.fullName || user.username;
      }
    }

    // Resolve an actor ID for audit / production log
    let actorUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: resolvedInchargeId || '' },
          { username: 'dyeing' },
          { departmentCode: 'DYEING' },
          { username: 'admin' },
        ],
      },
      select: { id: true },
    });
    if (!actorUser) {
      actorUser = await prisma.user.findFirst({ select: { id: true } });
    }

    // Transactional Update
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.dyeingOrder.update({
        where: { id },
        data: {
          dyedQuantity: newDyedQty,
          undyedQuantity: newUndyedQty,
          readyForQc1Quantity: newReadyForQc1Qty,
          status: finalStatus,
          dyedColor: dyedColor !== undefined ? dyedColor : existingOrder.dyedColor,
          colorCode: colorCode !== undefined ? colorCode : existingOrder.colorCode,
          inchargeId: resolvedInchargeId,
          inchargeName: resolvedInchargeName,
          batchNumber: batchNumber !== undefined ? batchNumber : existingOrder.batchNumber,
          machineNumber: machineNumber !== undefined ? machineNumber : existingOrder.machineNumber,
          processRemarks: processRemarks !== undefined ? processRemarks : existingOrder.processRemarks,
          startedAt: existingOrder.startedAt || new Date(),
          completedAt: ['DYED', 'READY_FOR_QC1', 'SENT_TO_QC1'].includes(finalStatus)
            ? (existingOrder.completedAt || new Date())
            : null,
        },
        include: {
          program: true,
          inboundChallan: true,
          qc1Challan: true,
          incharge: true,
        },
      });

      // Record Production Transaction for auditability and manufacturing traceability
      if (dyedQuantity !== undefined && actorUser) {
        await tx.productionTransaction.create({
          data: {
            programId: order.programId,
            challanId: order.inboundChallanId || (await tx.challan.findFirst({ select: { id: true } }))?.id || '',
            departmentCode: 'DYEING',
            operationName: 'FABRIC_DYEING',
            operatorId: actorUser.id,
            machineId: order.machineNumber || null,
            inputQuantity: order.requiredQuantity,
            goodQuantity: newDyedQty,
            balanceQuantity: newUndyedQty,
            unitOfMeasure: order.uom,
            notes: processRemarks || `Dyeing progress updated: ${newDyedQty} ${order.uom} dyed (${order.dyedColor || order.targetColor})`,
          },
        });
      }

      // Record Audit Log
      if (actorUser) {
        await tx.auditLog.create({
          data: {
            action: 'DYEING_UPDATE',
            entity: 'DyeingOrder',
            entityId: order.id,
            actor: {
              connect: { id: actorUser.id },
            },
            afterState: JSON.stringify({
              orderNumber: order.orderNumber,
              dyedQuantity: newDyedQty,
              undyedQuantity: newUndyedQty,
              status: finalStatus,
              dyedColor: order.dyedColor,
              inchargeName: order.inchargeName,
            }),
          },
        });
      }

      return order;
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error('Error updating dyeing order:', error);
    return NextResponse.json({ error: error.message || 'Failed to update dyeing order' }, { status: 500 });
  }
}
