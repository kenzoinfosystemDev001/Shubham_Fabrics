import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { inactiveDepartmentError } from '@/lib/departments';
import { challanNumberErrorResponse, duplicateChallanNumberResponse, isDuplicateChallanNumberError, validateManualChallanNumber } from '@/lib/challan-number';
import { STANDARD_FACTORY_ROUTE } from '@subham/config';
import { DepartmentCode } from '@subham/types';
import { buildDepartmentTrackingData } from '@/lib/challan-tracking';
import { authorizeDefectReport, DEFECTIVE_SHELF_INFO } from '@/lib/defective-shelf';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({ error: 'Parent Stitching Challan ID is required.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required for the handover Challan.' }, { status: 400 });
    }

    // 1. Resolve Target Department dynamically from Factory Route
    let targetDepartment = requestedTargetDept;
    if (!targetDepartment) {
      const stitchingIndex = STANDARD_FACTORY_ROUTE.indexOf(DepartmentCode.STITCHING);
      if (stitchingIndex !== -1 && stitchingIndex < STANDARD_FACTORY_ROUTE.length - 1) {
        targetDepartment = STANDARD_FACTORY_ROUTE[stitchingIndex + 1];
      } else {
        targetDepartment = 'FINISHING';
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
    let defectReporter: { id: string; fullName: string } | null = null;
    if (tracking.data.defectivePieces > 0) {
      if (!String(tracking.data.defectReason || '').trim()) return NextResponse.json({ error: 'Reason for defect is required before sending material to the defective shelf.' }, { status: 400 });
      const auth = await authorizeDefectReport(request, 'STITCHING');
      if (!auth.actor) return auth.response;
      defectReporter = { id: auth.actor.id, fullName: auth.actor.fullName };
    }

    if (totalGoodProduced > 0 && requestingQty > availableToHandover) {
      return NextResponse.json(
        {
          error: `Cannot issue ${requestingQty} pieces. Available unissued good balance is only ${availableToHandover} garments (Total good: ${totalGoodProduced}, Previously issued: ${previouslyHandedOver}).`,
        },
        { status: 400 }
      );
    }

    // 4. Resolve user identity
    let actorId = customActorId;
    if (!actorId) {
      const stitchUser = await prisma.user.findFirst({
        where: { OR: [{ username: 'stitching' }, { departmentCode: 'STITCHING' }] },
        select: { id: true },
      });
      actorId = stitchUser?.id;
    }
    if (!actorId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      actorId = fallbackUser?.id;
    }
    if (defectReporter) actorId = defectReporter.id;

    // Challan number is entered manually by the issuing department.
    const numberCheck = await validateManualChallanNumber(body.challanNumber);
    if (!numberCheck.ok) return challanNumberErrorResponse(numberCheck);
    const challanNumber = numberCheck.challanNumber;
    const departmentBlocked = await inactiveDepartmentError(prisma, ['STITCHING', targetDepartment]);
    if (departmentBlocked) return NextResponse.json({ error: departmentBlocked }, { status: 409 });

    // 6. ATOMIC DATABASE TRANSACTION
    const newChallan = await prisma.$transaction(async (tx) => {
      // Create outgoing Challan to next department
      const ch = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'INTER_DEPARTMENT',
          programId: programId || parentChallan.programId,
          parentChallanId: parentChallan.id,
          fromDepartment: 'STITCHING',
          toDepartment: targetDepartment,
          status: 'ISSUED',
          priority: priority || parentChallan.priority || 'NORMAL',
          issuedDate: new Date(),
          createdById: actorId,
          issuedById: actorId,
          remarks: remarks || `Handover from Stitching to ${targetDepartment}: Verified assembled garments.`,
          ...tracking.data,
          defectiveShelfLocation: tracking.data.defectivePieces > 0 ? DEFECTIVE_SHELF_INFO.STITCHING.code : null,
          items: {
            create: items.map((it: any) => ({
              itemDescription: it.itemDescription || `${parentChallan.program?.styleCode || 'Assembled'} Finished Garments - Ready for ${targetDepartment}`,
              fabricCode: it.fabricCode || 'GARMENT',
              colour: it.colour || it.color || parentChallan.program?.fabricColor || 'Standard',
              quantity: Number(it.quantity) || 0,
              uom: it.uom || 'PCS',
              unitType: it.unitType || 'PCS',
              barcode: it.barcode || `BC-ST-${Date.now().toString().slice(-6)}`,
              remarks: it.remarks || it.notes || 'Assembled garments passed end-line QC',
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
        const savedDefect = await tx.defectRecord.create({
          data: {
            defectCode: `DEF-STITCHING-${Date.now().toString().slice(-4)}`,
            programId: parentChallan.programId,
            challanId: ch.id,
            departmentCode: 'STITCHING',
            productionSheetNumber: parentChallan.program?.programSerialNo || parentChallan.program?.programNumber,
            shelfCode: DEFECTIVE_SHELF_INFO.STITCHING.code,
            color: items[0]?.colour || items[0]?.color || parentChallan.program?.fabricColor || null,
            fabricType: parentChallan.program?.fabricType || parentChallan.program?.fabricName || null,
            quantityUnit: tracking.data.fabricUnit,
            responsibleIncharge: defectReporter?.fullName || null,
            itemDescription: `Defective pieces from Stitching — quarantined on ${tracking.data.defectiveShelfLocation || 'department shelf'}`,
            severity: 'MAJOR',
            quantity: tracking.data.defectivePieces,
            reason: String(tracking.data.defectReason).trim(),
            detectedById: actorId,
            status: 'OPEN',
            resolutionNotes: `Defective ${tracking.data.defectivePieces} ${tracking.data.fabricUnit} segregated. ${requestingQty} ${tracking.data.fabricUnit} dispatched to ${targetDepartment}.`,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'DEFECT_SHELF_ENTRY_CREATED',
            entity: 'DefectRecord',
            entityId: savedDefect.id,
            afterState: JSON.stringify({ departmentCode: savedDefect.departmentCode, shelfCode: savedDefect.shelfCode, quantity: savedDefect.quantity, quantityUnit: savedDefect.quantityUnit, reason: savedDefect.reason, challanId: savedDefect.challanId }),
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
          notes: `Stitching Challan issued to ${targetDepartment} for ${requestingQty} finished garments. Parent job: ${parentChallan.challanNumber}`,
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
            notes: `All ${totalGoodProduced} good garments transferred to downstream department (${targetDepartment}) via ${challanNumber}.`,
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
    if (isDuplicateChallanNumberError(error)) {
      return duplicateChallanNumberResponse();
    }
    console.error('Error issuing Stitching Challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue Stitching Challan' },
      { status: 500 }
    );
  }
}
