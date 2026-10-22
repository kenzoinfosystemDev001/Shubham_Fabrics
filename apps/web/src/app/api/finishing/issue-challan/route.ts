import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { STANDARD_FACTORY_ROUTE } from '@subham/config';
import { DepartmentCode } from '@subham/types';

export const dynamic = 'force-dynamic';

class HandoverError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A valid handover request body is required.' }, { status: 400 });
    }

    const {
      parentChallanId,
      toDepartment: requestedTargetDept,
      priority,
      remarks,
      items,
    } = body;

    if (!parentChallanId) {
      return NextResponse.json({ error: 'Parent Finishing Challan ID is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required for the handover Challan.' }, { status: 400 });
    }

    const finishingIndex = STANDARD_FACTORY_ROUTE.indexOf(DepartmentCode.FINISHING);
    const targetDepartment = STANDARD_FACTORY_ROUTE[finishingIndex + 1];
    if (finishingIndex < 0 || !targetDepartment) {
      return NextResponse.json(
        { error: 'Finishing has no downstream department configured in the factory route.' },
        { status: 503 },
      );
    }
    if (requestedTargetDept && requestedTargetDept !== targetDepartment) {
      return NextResponse.json(
        { error: `Finishing handovers must go to the configured next department: ${targetDepartment}.` },
        { status: 400 },
      );
    }

    if (items.some((item: unknown) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return NextResponse.json({ error: 'Every handover item must be a valid item object.' }, { status: 400 });
    }

    const parentChallan = await prisma.challan.findUnique({
      where: { id: parentChallanId },
      include: { program: true },
    });

    if (!parentChallan) {
      return NextResponse.json({ error: 'Parent Challan not found.' }, { status: 404 });
    }

    if (!['FINISHING', 'FINISH', 'TRIMMING'].includes(parentChallan.toDepartment.toUpperCase())) {
      return NextResponse.json({ error: 'The selected challan is not assigned to Finishing.' }, { status: 400 });
    }

    if (!['READY_FOR_HANDOVER', 'COMPLETED'].includes(parentChallan.status)) {
      return NextResponse.json(
        { error: `Finishing must be completed before handover. Current status: '${parentChallan.status}'.` },
        { status: 400 }
      );
    }

    const quantities = items.map((item: any) => Number(item?.quantity));
    if (quantities.some((quantity: number) => !Number.isSafeInteger(quantity) || quantity <= 0)) {
      return NextResponse.json(
        { error: 'Each handover item quantity must be a positive whole number of garments.' },
        { status: 400 },
      );
    }
    const requestingQty = quantities.reduce((sum: number, quantity: number) => sum + quantity, 0);
    if (!Number.isSafeInteger(requestingQty)) {
      return NextResponse.json({ error: 'The total handover quantity is outside the supported range.' }, { status: 400 });
    }

    const actor = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ username: 'finishing' }, { departmentCode: 'FINISHING' }],
      },
      select: { id: true },
    });
    if (!actor) {
      return NextResponse.json({ error: 'No active Finishing operator is configured. Contact an administrator.' }, { status: 503 });
    }

    const actorId = actor.id;
    const challanNumber = `CH-FN-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const newChallan = await prisma.$transaction(async (tx) => {
      const claim = await tx.challan.updateMany({
        where: {
          id: parentChallan.id,
          status: parentChallan.status,
          toDepartment: parentChallan.toDepartment,
        },
        data: { status: 'HANDOVER_PROCESSING' },
      });
      if (claim.count !== 1) {
        throw new HandoverError('This Finishing job changed during handover. Refresh and try again.', 409);
      }

      const currentParent = await tx.challan.findUnique({
        where: { id: parentChallan.id },
        include: {
          program: true,
          childChallans: {
            where: {
              fromDepartment: DepartmentCode.FINISHING,
              toDepartment: targetDepartment,
              challanType: 'INTER_DEPARTMENT',
            },
            include: { items: true },
          },
        },
      });
      if (!currentParent) throw new HandoverError('Parent Challan no longer exists.', 409);

      const totalGoodProduced = Number(currentParent.fabricOut ?? currentParent.fabricIn ?? 0);
      if (!Number.isSafeInteger(totalGoodProduced) || totalGoodProduced <= 0) {
        throw new HandoverError('This job has no valid completed good quantity available for handover.');
      }
      const previouslyHandedOver = currentParent.childChallans.reduce(
        (sum, child) => sum + child.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
        0,
      );
      const availableToHandover = Math.max(0, totalGoodProduced - previouslyHandedOver);
      if (requestingQty > availableToHandover) {
        throw new HandoverError(
          `Cannot issue ${requestingQty} pieces. Available unissued good balance is ${availableToHandover}.`,
          409,
        );
      }

      const ch = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: currentParent.programId,
          parentChallanId: currentParent.id,
          fromDepartment: DepartmentCode.FINISHING,
          toDepartment: targetDepartment,
          status: 'ISSUED',
          priority: priority || currentParent.priority || 'NORMAL',
          issuedDate: new Date(),
          createdById: actorId,
          issuedById: actorId,
          remarks: remarks || `Handover from Finishing to ${targetDepartment}: Trimmed, cleaned & pressed garments.`,
          fabricIn: requestingQty,
          fabricOut: requestingQty,
          items: {
            create: items.map((it: any) => ({
              itemDescription: it.itemDescription || `${currentParent.program?.styleCode || 'Finished'} Garments - Ready for ${targetDepartment}`,
              fabricCode: it.fabricCode || 'GARMENT',
              colour: it.colour || it.color || currentParent.program?.fabricColor || 'Standard',
              quantity: Number(it.quantity),
              uom: it.uom || 'PCS',
              unitType: it.unitType || 'PCS',
              barcode: it.barcode || `BC-FN-${Date.now().toString().slice(-6)}`,
              remarks: it.remarks || it.notes || 'Passed finishing QC checks',
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

      // Audit event for newly created outgoing Challan
      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_ISSUED',
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          actorId: actorId,
          notes: `Finishing Challan issued to ${targetDepartment} for ${requestingQty} finished garments. Parent job: ${parentChallan.challanNumber}`,
        },
      });

      const remainingBalance = availableToHandover - requestingQty;
      const finalStatus = remainingBalance === 0 ? 'HANDED_OVER' : parentChallan.status;
      await tx.challan.update({
        where: { id: currentParent.id },
        data: { status: finalStatus },
      });
      await tx.challanEvent.create({
        data: {
          challanId: currentParent.id,
          action: remainingBalance === 0 ? 'CHALLAN_HANDED_OVER' : 'CHALLAN_PARTIALLY_HANDED_OVER',
          fromStatus: parentChallan.status,
          toStatus: finalStatus,
          actorId,
          notes: `${requestingQty} good garments transferred to ${targetDepartment} via ${challanNumber}; ${remainingBalance} remain available.`,
        },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${newChallan.challanNumber} issued successfully to ${targetDepartment}`,
      data: newChallan,
    });
  } catch (error: any) {
    if (error instanceof HandoverError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A handover identifier conflicted with another request. Refresh and retry.' },
        { status: 409 },
      );
    }
    console.error('Error issuing Finishing Challan:', error);
    return NextResponse.json(
      { error: 'Failed to issue the Finishing handover Challan. Please retry or contact support with the job number.' },
      { status: 500 }
    );
  }
}
