import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { guardStoreChallanStatusChange, resolveStockActorId, StockChangeError } from '@/lib/fabric-stock-ledger';
import { isCanonicalChallanStatus, isLegalChallanTransition } from '@subham/types';
import { authorizeDefectReport, DEFECTIVE_SHELF_INFO, normalizeShelfDepartment } from '@/lib/defective-shelf';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      notes,
      receiverId,
      fabricIn,
      fabricOut,
      fabricUnit,
      defectivePieces,
      defectiveShelfLocation,
      defectReason,
      color: submittedColor,
      fabricType: submittedFabricType,
    } = body;

    // 1. Fetch current challan details
    const existing = await prisma.challan.findUnique({
      where: { id },
      include: {
        items: true,
        program: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    // Enforce the shared SOP-02 state machine. Department-specific statuses outside the
    // canonical set (e.g. PARTIALLY_RECEIVED) are managed by their own routes and pass through.
    if (
      status &&
      status !== existing.status &&
      isCanonicalChallanStatus(status) &&
      isCanonicalChallanStatus(existing.status) &&
      !isLegalChallanTransition(existing.status, status)
    ) {
      return NextResponse.json(
        { error: `Illegal transition from '${existing.status}' to '${status}'.` },
        { status: 409 }
      );
    }

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === 'RECEIVED') {
        data.receivedDate = new Date();
        if (receiverId) {
          data.receivedById = receiverId;
        } else {
          // Find department user or fallback
          const deptUser = await prisma.user.findFirst({
            where: {
              OR: [
                { departmentCode: existing.toDepartment },
                { username: existing.toDepartment.toLowerCase() },
              ],
            },
            select: { id: true },
          });
          if (deptUser) {
            data.receivedById = deptUser.id;
          }
        }
      } else if (status === 'COMPLETED') {
        data.completedDate = new Date();
      }
    }

    if (notes) {
      data.remarks = notes;
    }

    // Fabric / Piece tracking
    if (fabricIn !== undefined && fabricIn !== null) {
      data.fabricIn = Number(fabricIn);
    } else if (status === 'RECEIVED' && (existing.fabricIn === null || existing.fabricIn === 0)) {
      const itemsQty = existing.items.reduce(
        (sum, it) => sum + (Number(it.quantity) || 0),
        0
      );
      data.fabricIn = itemsQty > 0 ? itemsQty : Number(existing.program?.targetQuantity || 0);
    }

    if (fabricUnit !== undefined) data.fabricUnit = fabricUnit;

    let defectReporter: { id: string; fullName: string } | null = null;
    let defectDepartment: string | null = null;
    let defectColor: string | null = null;
    let defectFabricType: string | null = null;
    if (defectivePieces !== undefined && defectivePieces !== null) {
      const quantity = Number(defectivePieces);
      if (!Number.isFinite(quantity) || quantity < 0) return NextResponse.json({ error: 'Defective quantity must be zero or greater.' }, { status: 400 });
      if (quantity < Number(existing.defectivePieces || 0)) {
        return NextResponse.json({ error: 'Defective quantity cannot be reduced here. Use the authorized disposition workflow.' }, { status: 409 });
      }
      data.defectivePieces = quantity;
      if (quantity > 0) {
        defectDepartment = normalizeShelfDepartment(existing.toDepartment || existing.fromDepartment);
        if (!defectDepartment || !DEFECTIVE_SHELF_INFO[defectDepartment as keyof typeof DEFECTIVE_SHELF_INFO]) {
          return NextResponse.json({ error: 'This department does not have a departmental defective shelf.' }, { status: 400 });
        }
        const submittedReason = String(defectReason || '').trim();
        const requiresNewReason = quantity > Number(existing.defectivePieces || 0) || !String(existing.defectReason || '').trim();
        const reason = submittedReason || String(existing.defectReason || '').trim();
        if (requiresNewReason && !submittedReason) return NextResponse.json({ error: 'Reason for defect is required before sending material to a defective shelf.' }, { status: 400 });
        defectColor = String(submittedColor || existing.items[0]?.colour || existing.program?.fabricColor || '').trim() || null;
        defectFabricType = String(submittedFabricType || existing.program?.fabricType || existing.program?.fabricName || existing.items[0]?.fabricCode || '').trim() || null;
        if (!defectColor || !defectFabricType) return NextResponse.json({ error: 'Color and fabric type must be recorded on the production sheet or challan before reporting a defect.' }, { status: 400 });
        const auth = await authorizeDefectReport(request, defectDepartment);
        if (!auth.actor) return auth.response;
        defectReporter = { id: auth.actor.id, fullName: auth.actor.fullName };
        data.defectiveShelfLocation = DEFECTIVE_SHELF_INFO[defectDepartment as keyof typeof DEFECTIVE_SHELF_INFO].code;
        data.defectReason = reason;
      }
    }

    if (fabricOut !== undefined && fabricOut !== null) {
      data.fabricOut = Number(fabricOut);
    } else if (data.fabricIn !== undefined && data.defectivePieces !== undefined) {
      data.fabricOut = Math.max(0, data.fabricIn - data.defectivePieces);
    }

    // 2. Perform Transaction to update Challan and operational logs
    const stockActorId = await resolveStockActorId(request);

    const updated = await prisma.$transaction(async (tx) => {
      // Moving a Fabric Store challan into or out of DRAFT / CANCELLED changes stock.
      const finishStockChange = await guardStoreChallanStatusChange(tx, existing, status, stockActorId);
      const ch = await tx.challan.update({
        where: { id },
        data,
        include: {
          program: true,
          items: true,
          fromDeptRel: true,
          toDeptRel: true,
        },
      });

      // Log ChallanEvent if status changed
      if (status && status !== existing.status) {
        const actor = defectReporter;
        if (actor) {
          try {
            await tx.challanEvent.create({
              data: {
                challanId: id,
                fromStatus: existing.status,
                toStatus: status,
                action: status === 'RECEIVED' ? 'RECEIVE' : status === 'COMPLETED' ? 'COMPLETE' : 'STATUS_CHANGE',
                actorId: data.receivedById || actor.id,
                notes: notes || `Challan ${ch.challanNumber} status changed to ${status}`,
                metadata: JSON.stringify({
                  timestamp: new Date(),
                  fabricIn: ch.fabricIn,
                  fabricOut: ch.fabricOut,
                  defectivePieces: ch.defectivePieces,
                }),
              },
            });
          } catch (e) {
            console.warn('Failed to record ChallanEvent:', e);
          }
        }
      }

      // If toDepartment is DYEING and status is RECEIVED, update linked DyeingOrder
      if (
        (ch.toDepartment === 'DYEING' || ch.toDepartment.toLowerCase().includes('dye')) &&
        status === 'RECEIVED'
      ) {
        try {
          await tx.dyeingOrder.updateMany({
            where: { inboundChallanId: id },
            data: { status: 'RECEIVED' },
          });
        } catch (e) {
          console.warn('Failed to sync DyeingOrder status:', e);
        }
      }

      // Keep one traceable shelf record for this challan and department.
      if (data.defectivePieces && data.defectivePieces > 0 && defectReporter && defectDepartment) {
        const quantityUnit = data.fabricUnit || ch.fabricUnit || ch.items[0]?.uom || 'PCS';
        const defectData = {
          programId: ch.programId,
          challanId: ch.id,
          departmentCode: defectDepartment,
          shelfCode: data.defectiveShelfLocation,
          color: defectColor,
          fabricType: defectFabricType,
          quantityUnit,
          productionSheetNumber: ch.program?.programSerialNo || ch.program?.programNumber,
          responsibleIncharge: defectReporter.fullName,
          itemDescription: `Defective material reported from ${defectDepartment}`,
          severity: 'MAJOR',
          quantity: data.defectivePieces,
          reason: data.defectReason,
          detectedById: defectReporter.id,
          status: 'OPEN',
          resolutionNotes: `Quarantined on ${data.defectiveShelfLocation}; disposition requires authorized workflow.`,
        };
        const previousRecords = await tx.defectRecord.findMany({
          where: { challanId: ch.id, departmentCode: defectDepartment, status: { not: 'REWORK' } },
          orderBy: { createdAt: 'asc' },
        });
        const previouslyLoggedQuantity = previousRecords.reduce(
          (sum, record) => sum + Number(record.quantity || 0),
          0,
        );
        let savedRecord: any = null;
        let auditAction: string | null = null;
        let beforeState: string | undefined;
        let savedData = defectData;

        if (previousRecords.length === 0) {
          savedRecord = await tx.defectRecord.create({
            data: {
              ...defectData,
              defectCode: `DEF-${defectDepartment}-${Date.now().toString().slice(-6)}`,
            },
          });
          auditAction = 'DEFECT_SHELF_ENTRY_CREATED';
        } else if (previousRecords.length === 1 && !previousRecords[0].shelfRemovedAt) {
          const previous = previousRecords[0];
          savedRecord = await tx.defectRecord.update({ where: { id: previous.id }, data: defectData });
          auditAction = 'DEFECT_SHELF_ENTRY_UPDATED';
          beforeState = JSON.stringify({ quantity: previous.quantity, reason: previous.reason, shelfCode: previous.shelfCode });
        } else if (Number(defectData.quantity) > previouslyLoggedQuantity) {
          // Material already archived from this challan stays archived; only newly rejected quantity enters the shelf.
          savedData = { ...defectData, quantity: Number(defectData.quantity) - previouslyLoggedQuantity };
          savedRecord = await tx.defectRecord.create({
            data: {
              ...savedData,
              defectCode: `DEF-${defectDepartment}-${Date.now().toString().slice(-6)}`,
            },
          });
          auditAction = 'DEFECT_SHELF_ENTRY_CREATED';
        }

        if (savedRecord && auditAction) {
          await tx.auditLog.create({
            data: {
              actorId: defectReporter.id,
              action: auditAction,
              entity: 'DefectRecord',
              entityId: savedRecord.id,
              beforeState,
              afterState: JSON.stringify({ quantity: savedData.quantity, quantityUnit, reason: savedData.reason, departmentCode: defectDepartment, shelfCode: savedData.shelfCode }),
            },
          });
        }

      }

      await finishStockChange(tx);
      return ch;
    }, { maxWait: 15000, timeout: 30000 });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof StockChangeError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error updating challan status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update challan status' },
      { status: 500 }
    );
  }
}
