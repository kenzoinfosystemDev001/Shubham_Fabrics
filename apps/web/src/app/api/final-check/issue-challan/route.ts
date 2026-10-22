import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { STANDARD_FACTORY_ROUTE } from '@subham/config';
import { DepartmentCode } from '@subham/types';
import { getFinalCheckActor } from '@/lib/final-check-auth';
import {
  availableAcceptedQuantity,
  FinalCheckValidationError,
  parseWholeNumber,
  validateHandoverQuantity,
} from '@/lib/final-check-rules.mjs';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];
class HandoverValidationError extends Error {}

export async function GET(request: Request) {
  try {
    const auth = await getFinalCheckActor(request);
    if (!auth.actor) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');
    const eligibleStatuses = [
      'QC_APPROVED',
      'QC_REJECTED',
      'REWORK_REQUESTED',
      'READY_FOR_HANDOVER',
      'COMPLETED',
      'READY_FOR_DISPATCH',
    ];
    const finalCheckIndex = STANDARD_FACTORY_ROUTE.indexOf(DepartmentCode.FINAL_CHECK);
    const targetDepartment = STANDARD_FACTORY_ROUTE[finalCheckIndex + 1];
    if (finalCheckIndex < 0 || !targetDepartment) {
      return NextResponse.json(
        { error: 'Final QC has no next department configured in the standard factory route.' },
        { status: 503 },
      );
    }
    // Accepted inspection results are eligible for downstream handover.
    const challans = await prisma.challan.findMany({
      where: {
        toDepartment: { in: FINAL_CHECK_DEPTS },
        status: {
          in: eligibleStatuses,
          ...(status && status !== 'ALL' ? { equals: status } : {}),
        },
        ...(search
          ? {
              OR: [
                { challanNumber: { contains: search, mode: 'insensitive' as const } },
                { program: { programNumber: { contains: search, mode: 'insensitive' as const } } },
                { program: { styleCode: { contains: search, mode: 'insensitive' as const } } },
                { program: { clientName: { contains: search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: {
        program: {
          select: {
            id: true,
            programNumber: true,
            programSerialNo: true,
            clientName: true,
            buyerName: true,
            styleCode: true,
            designNumber: true,
            wilcomDesignNumber: true,
            fabricName: true,
            fabricColor: true,
            targetQuantity: true,
            quantityMeasurement: true,
            mainStyle: true,
          },
        },
        items: true,
        issuedBy: { select: { id: true, fullName: true, username: true } },
        receivedBy: { select: { id: true, fullName: true, username: true } },
        childChallans: {
          where: {
            fromDepartment: DepartmentCode.FINAL_CHECK,
            toDepartment: targetDepartment,
            challanType: 'INTER_DEPARTMENT',
          },
          include: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = challans.map((challan) => {
      const previouslyHandedOver = challan.childChallans.reduce(
        (sum, child) => sum + child.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0),
        0,
      );
      const acceptedQuantity = Number(challan.fabricOut ?? 0);
      return {
        ...challan,
        availableToHandover: availableAcceptedQuantity(acceptedQuantity, previouslyHandedOver),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching Final QC ready challans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ready challans' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getFinalCheckActor(request);
    if (!auth.actor) return auth.response;

    const body = await request.json();
    const {
      parentChallanId,
      toDepartment: requestedTargetDept,
      priority,
      remarks,
      items,
    } = body;

    if (!parentChallanId) {
      return NextResponse.json({ error: 'Parent Final QC Challan ID is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required for the handover Challan.' }, { status: 400 });
    }

    const finalCheckIndex = STANDARD_FACTORY_ROUTE.indexOf(DepartmentCode.FINAL_CHECK);
    const targetDepartment = STANDARD_FACTORY_ROUTE[finalCheckIndex + 1];
    if (finalCheckIndex < 0 || !targetDepartment) {
      return NextResponse.json(
        { error: 'Final QC has no next department configured in the standard factory route.' },
        { status: 503 },
      );
    }
    if (requestedTargetDept && requestedTargetDept !== targetDepartment) {
      return NextResponse.json(
        { error: `Final QC handover must go to the configured next department: ${targetDepartment}.` },
        { status: 400 },
      );
    }

    const parentChallan = await prisma.challan.findUnique({
      where: { id: parentChallanId },
      include: {
        program: true,
      },
    });

    if (!parentChallan) {
      return NextResponse.json({ error: 'Parent Challan not found.' }, { status: 404 });
    }

    if (!FINAL_CHECK_DEPTS.map((d) => d.toUpperCase()).includes(parentChallan.toDepartment.toUpperCase())) {
      return NextResponse.json(
        { error: 'This challan does not belong to the Final QC department.' },
        { status: 400 }
      );
    }

    if (!['QC_APPROVED', 'QC_REJECTED', 'REWORK_REQUESTED', 'COMPLETED', 'READY_FOR_HANDOVER', 'READY_FOR_DISPATCH'].includes(parentChallan.status)) {
      return NextResponse.json(
        { error: `Challan must have a completed inspection before handover. Current status: '${parentChallan.status}'.` },
        { status: 400 }
      );
    }

    let itemQuantities: number[];
    try {
      itemQuantities = items.map((item: any) => {
        const quantity = parseWholeNumber(item.quantity, 'Handover item quantity');
        if (quantity <= 0) throw new FinalCheckValidationError('Every handover item quantity must be greater than zero.');
        return quantity;
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Handover item quantity is invalid.' },
        { status: 400 },
      );
    }
    const requestingQty = itemQuantities.reduce((sum, quantity) => sum + quantity, 0);

    const actorId = auth.actor.id;

    // Generate unique challan number
    const challanNumber = `CH-FQC-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const newChallan = await prisma.$transaction(async (tx) => {
      const claimed = await tx.challan.updateMany({
        where: { id: parentChallan.id, status: parentChallan.status },
        data: { status: 'HANDOVER_PROCESSING' },
      });
      if (claimed.count !== 1) {
        throw new HandoverValidationError('This Final QC job changed during handover. Refresh and retry.');
      }

      const currentParent = await tx.challan.findUnique({
        where: { id: parentChallan.id },
        include: {
          childChallans: {
            where: {
              fromDepartment: DepartmentCode.FINAL_CHECK,
              toDepartment: targetDepartment,
              challanType: 'INTER_DEPARTMENT',
            },
            include: { items: true },
          },
        },
      });
      if (!currentParent) throw new HandoverValidationError('Final QC parent challan no longer exists.');

      const totalAcceptedQty = Number(currentParent.fabricOut ?? 0);
      const previouslyHandedOver = currentParent.childChallans.reduce(
        (sum, child) => sum + child.items.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0),
        0,
      );
      const availableToHandover = availableAcceptedQuantity(totalAcceptedQty, previouslyHandedOver);
      validateHandoverQuantity(requestingQty, availableToHandover);

      const ch = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: currentParent.programId,
          parentChallanId: currentParent.id,
          fromDepartment: 'FINAL_CHECK',
          toDepartment: targetDepartment,
          status: 'ISSUED',
          priority: priority || parentChallan.priority || 'NORMAL',
          issuedDate: new Date(),
          createdById: actorId,
          issuedById: actorId,
          remarks: remarks || `Handover from Final QC to ${targetDepartment}: accepted garments ready for the next production stage.`,
          fabricIn: requestingQty,
          fabricOut: requestingQty,
          items: {
            create: items.map((it: any) => ({
              itemDescription:
                it.itemDescription ||
                `${parentChallan.program?.styleCode || 'Garment'} — Final QC Accepted — Ready for ${targetDepartment}`,
              fabricCode: it.fabricCode || 'GARMENT',
              colour: it.colour || it.color || parentChallan.program?.fabricColor || 'Standard',
              quantity: Number(it.quantity) || 0,
              uom: it.uom || 'PCS',
              unitType: it.unitType || 'PCS',
              barcode: it.barcode || `BC-FQC-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 6)}`,
              remarks: it.remarks || it.notes || 'Passed final quality inspection',
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

      // Audit event on outgoing challan
      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_ISSUED',
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          actorId: actorId,
          notes: `Final QC Challan ${challanNumber} issued to ${targetDepartment} for ${requestingQty} inspected garments. Parent: ${parentChallan.challanNumber}`,
        },
      });

      // If entire accepted balance transferred, mark parent as HANDED_OVER
      const remainingBalance = availableToHandover - requestingQty;
      if (remainingBalance <= 0) {
        await tx.challanEvent.create({
          data: {
            challanId: currentParent.id,
            action: 'CHALLAN_HANDED_OVER',
            fromStatus: parentChallan.status,
            toStatus: 'HANDED_OVER',
            actorId: actorId,
            notes: `All ${totalAcceptedQty} accepted garments transferred to ${targetDepartment} via ${challanNumber}.`,
          },
        });
      }

      await tx.challan.update({
        where: { id: currentParent.id },
        data: { status: remainingBalance <= 0 ? 'HANDED_OVER' : parentChallan.status },
      });

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${newChallan.challanNumber} issued successfully to ${targetDepartment}`,
      data: newChallan,
    });
  } catch (error: any) {
    if (error instanceof HandoverValidationError || error instanceof FinalCheckValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof HandoverValidationError ? 409 : 400 },
      );
    }
    console.error('Error issuing Final QC Challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue Final QC Challan' },
      { status: 500 }
    );
  }
}
