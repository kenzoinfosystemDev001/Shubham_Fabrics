import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { STANDARD_FACTORY_ROUTE } from '@subham/config';
import { DepartmentCode } from '@subham/types';
import { buildDepartmentTrackingData } from '@/lib/challan-tracking';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'STEAM_PRESS');
  if (!authUser) return authResponse;
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
      return NextResponse.json({ error: 'Parent Steam Press Challan ID is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required for the handover Challan.' }, { status: 400 });
    }

    // 1. Resolve Target Department (defaults to FINAL_CHECK - Final QC)
    let targetDepartment = requestedTargetDept;
    if (!targetDepartment) {
      const steamPressIndex = STANDARD_FACTORY_ROUTE.indexOf(DepartmentCode.STEAM_PRESS);
      if (steamPressIndex !== -1 && steamPressIndex < STANDARD_FACTORY_ROUTE.length - 1) {
        targetDepartment = STANDARD_FACTORY_ROUTE[steamPressIndex + 1];
      } else {
        targetDepartment = 'FINAL_CHECK';
      }
    }

    // 2. Fetch Parent Challan
    const parentChallan = await prisma.challan.findUnique({
      where: { id: parentChallanId },
      include: {
        program: true,
        childChallans: {
          include: { items: true },
        },
      },
    });

    if (!parentChallan) {
      return NextResponse.json({ error: 'Parent Challan not found.' }, { status: 404 });
    }

    // 3. Compute available good balance to prevent over-issuance
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
          error: `Cannot issue ${requestingQty} pieces. Available unissued good balance is only ${availableToHandover} pressed garments (Total good: ${totalGoodProduced}, Previously issued: ${previouslyHandedOver}).`,
        },
        { status: 400 }
      );
    }
    const tracking = buildDepartmentTrackingData(
      body,
      requestingQty,
      Number(parentChallan.fabricOut ?? parentChallan.fabricIn ?? requestingQty),
      parentChallan.id,
      parentChallan.fromDepartment
    );
    if ('error' in tracking) {
      return NextResponse.json({ error: tracking.error }, { status: 400 });
    }

    // 4. Resolve user identity
    const actorId = authUser.id;

    // 5. Generate unique sequential Challan Number
    const count = await prisma.challan.count({
      where: { fromDepartment: 'STEAM_PRESS' },
    });
    const timestamp = Date.now().toString().slice(-4);
    const challanNumber = `CH-SP-${String(count + 1).padStart(4, '0')}-${timestamp}`;

    // 6. ATOMIC DATABASE TRANSACTION
    const newChallan = await prisma.$transaction(async (tx) => {
      // Create outgoing Challan to downstream department (Final QC)
      const ch = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: programId || parentChallan.programId,
          parentChallanId: parentChallan.id,
          fromDepartment: 'STEAM_PRESS',
          toDepartment: targetDepartment,
          status: 'ISSUED',
          priority: priority || parentChallan.priority || 'NORMAL',
          issuedDate: new Date(),
          createdById: actorId,
          issuedById: actorId,
          remarks: remarks || `Handover from Steam Press to ${targetDepartment}: Steam pressed and crease-set garments.`,
          ...tracking.data,
          items: {
            create: items.map((it: any) => ({
              itemDescription: it.itemDescription || `${parentChallan.program?.styleCode || 'Pressed'} Garments - Ready for ${targetDepartment}`,
              fabricCode: it.fabricCode || 'GARMENT',
              colour: it.colour || it.color || parentChallan.program?.fabricColor || 'Standard',
              quantity: Number(it.quantity) || 0,
              uom: it.uom || 'PCS',
              unitType: it.unitType || 'PCS',
              barcode: it.barcode || `BC-SP-${Date.now().toString().slice(-6)}`,
              remarks: it.remarks || it.notes || 'Passed steam press inspection',
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

      if (tracking.data.defectivePieces > 0 && actorId) {
        await tx.defectRecord.create({
          data: {
            defectCode: `DEF-STEAM_PRESS-${Date.now().toString().slice(-4)}`,
            programId: parentChallan.programId,
            challanId: ch.id,
            departmentCode: 'STEAM_PRESS',
            itemDescription: `Defective pieces from Steam Press — quarantined on ${tracking.data.defectiveShelfLocation || 'department shelf'}`,
            severity: 'MAJOR',
            quantity: Math.max(1, Math.round(tracking.data.defectivePieces)),
            reason: tracking.data.defectReason || 'Defective piece found during department processing',
            detectedById: actorId,
            status: 'OPEN',
            resolutionNotes: `Defective ${tracking.data.defectivePieces} ${tracking.data.fabricUnit} segregated. ${requestingQty} ${tracking.data.fabricUnit} dispatched to ${targetDepartment}.`,
          },
        });
      }

      // Audit event for newly created outgoing Challan
      await tx.challanEvent.create({
        data: {
          challanId: ch.id,
          action: 'CHALLAN_ISSUED',
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          actorId: actorId,
          notes: `Steam Press Challan issued to ${targetDepartment} for ${requestingQty} pressed garments. Parent job: ${parentChallan.challanNumber}`,
        },
      });

      // Update parent challan status to HANDED_OVER if entire available balance has been transferred
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
            notes: `All ${totalGoodProduced} good pressed garments transferred to downstream department (${targetDepartment}) via ${challanNumber}.`,
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
    console.error('Error issuing Steam Press Challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue Steam Press Challan' },
      { status: 500 }
    );
  }
}
