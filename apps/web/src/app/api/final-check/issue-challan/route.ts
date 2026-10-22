import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

const FINAL_CHECK_DEPTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

export async function GET(request: Request) {
  try {
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
      const acceptedQuantity = Number(challan.fabricOut ?? challan.fabricIn ?? 0);
      return {
        ...challan,
        availableToHandover: Math.max(0, acceptedQuantity - previouslyHandedOver),
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
    const body = await request.json();
    const {
      parentChallanId,
      programId,
      toDepartment: requestedTargetDept,
      priority,
      remarks,
      items,
      actorId: customActorId,
    } = body;

    if (!parentChallanId) {
      return NextResponse.json({ error: 'Parent Final QC Challan ID is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required for the handover Challan.' }, { status: 400 });
    }

    // Resolve target department — dynamically from route config, default to PACKING
    let targetDepartment = requestedTargetDept;
    if (!targetDepartment) {
      try {
        const { STANDARD_FACTORY_ROUTE } = await import('@subham/config');
        const fqcIndex = STANDARD_FACTORY_ROUTE.findIndex(
          (d: string) => d === 'FINAL_CHECK' || d === 'FINAL_QC'
        );
        if (fqcIndex !== -1 && fqcIndex < STANDARD_FACTORY_ROUTE.length - 1) {
          targetDepartment = STANDARD_FACTORY_ROUTE[fqcIndex + 1];
        }
      } catch {
        // config package may not export STANDARD_FACTORY_ROUTE
      }
      if (!targetDepartment) targetDepartment = 'PACKING';
    }

    const parentChallan = await prisma.challan.findUnique({
      where: { id: parentChallanId },
      include: {
        program: true,
        childChallans: { include: { items: true } },
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

    // Compute available balance preventing over-issuance
    const totalAcceptedQty = Number(parentChallan.fabricOut ?? parentChallan.fabricIn ?? 0);
    const previouslyHandedOver = parentChallan.childChallans.reduce(
      (sum, ch) => sum + ch.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      0
    );
    const availableToHandover = Math.max(0, totalAcceptedQty - previouslyHandedOver);

    const itemQuantities = items.map((item: any) => Number(item.quantity));
    if (itemQuantities.some((quantity) => !Number.isInteger(quantity) || quantity <= 0)) {
      return NextResponse.json({ error: 'Every handover item must have a positive whole-number quantity.' }, { status: 400 });
    }
    const requestingQty = itemQuantities.reduce((sum, quantity) => sum + quantity, 0);

    if (requestingQty > availableToHandover) {
      return NextResponse.json(
        {
          error: `Cannot issue ${requestingQty} pieces. Available accepted balance is only ${availableToHandover} (Total accepted: ${totalAcceptedQty}, Previously issued: ${previouslyHandedOver}).`,
        },
        { status: 400 }
      );
    }

    // Resolve actor
    let actorId = customActorId;
    if (!actorId) {
      const fcUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'finalcheck' }, { username: 'final_check' }, { departmentCode: 'FINAL_CHECK' }] },
        select: { id: true },
      });
      actorId = fcUser?.id;
    }
    if (!actorId) {
      const fallback = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallback?.id;
    }

    // Generate unique challan number
    const count = await prisma.challan.count({ where: { fromDepartment: 'FINAL_CHECK' } });
    const timestamp = Date.now().toString().slice(-4);
    const challanNumber = `CH-FQC-${String(count + 1).padStart(4, '0')}-${timestamp}`;

    const newChallan = await prisma.$transaction(async (tx) => {
      // Create outgoing challan to downstream (PACKING)
      const ch = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: programId || parentChallan.programId,
          parentChallanId: parentChallan.id,
          fromDepartment: 'FINAL_CHECK',
          toDepartment: targetDepartment,
          status: 'ISSUED',
          priority: priority || parentChallan.priority || 'NORMAL',
          issuedDate: new Date(),
          createdById: actorId,
          issuedById: actorId,
          remarks:
            remarks ||
            `Handover from Final QC to ${targetDepartment}: Inspected & accepted garments ready for dispatch.`,
          fabricIn: requestingQty,
          fabricOut: requestingQty,
          items: {
            create: items.map((it: any) => ({
              itemDescription:
                it.itemDescription ||
                `${parentChallan.program?.styleCode || 'Garment'} — Final QC Passed — Ready for ${targetDepartment}`,
              fabricCode: it.fabricCode || 'GARMENT',
              colour: it.colour || it.color || parentChallan.program?.fabricColor || 'Standard',
              quantity: Number(it.quantity) || 0,
              uom: it.uom || 'PCS',
              unitType: it.unitType || 'PCS',
              barcode: it.barcode || `BC-FQC-${Date.now().toString().slice(-6)}`,
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
        await tx.challan.update({
          where: { id: parentChallan.id },
          data: { status: 'HANDED_OVER' },
        });

        await tx.challanEvent.create({
          data: {
            challanId: parentChallan.id,
            action: 'CHALLAN_HANDED_OVER',
            fromStatus: parentChallan.status,
            toStatus: 'HANDED_OVER',
            actorId: actorId,
            notes: `All ${totalAcceptedQty} accepted garments transferred to ${targetDepartment} via ${challanNumber}.`,
          },
        });
      }

      return ch;
    });

    return NextResponse.json({
      success: true,
      message: `Challan ${newChallan.challanNumber} issued successfully to ${targetDepartment}`,
      data: newChallan,
    });
  } catch (error: any) {
    console.error('Error issuing Final QC Challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue Final QC Challan' },
      { status: 500 }
    );
  }
}
