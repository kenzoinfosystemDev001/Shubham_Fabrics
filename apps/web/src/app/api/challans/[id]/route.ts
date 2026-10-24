import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { guardStoreChallanStatusChange, resolveStockActorId, StockChangeError } from '@/lib/fabric-stock-ledger';
import { authorizeDefectReport, DEFECTIVE_SHELF_INFO, getDefectiveShelfActor, normalizeShelfDepartment } from '@/lib/defective-shelf';
import { isAlertDepartmentActive, syncDepartmentAlerts } from '@/lib/deadline-alerts/engine';
import { auditAdminAction, readReason, reasonRequiredResponse, requireAdmin } from '@/lib/admin-auth';
import { isFabricStoreDepartment } from '@/lib/fabric-stock';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        program: true,
        items: true,
        fromDeptRel: true,
        toDeptRel: true,
        parentChallan: {
          select: {
            id: true,
            challanNumber: true,
            challanType: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            issuedDate: true,
            remarks: true,
            fabricIn: true,
            fabricOut: true,
            fabricUnit: true,
            defectivePieces: true,
            defectiveShelfLocation: true,
            defectReason: true,
            items: true,
          },
        },
        childChallans: {
          select: {
            id: true,
            challanNumber: true,
            challanType: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            issuedDate: true,
            remarks: true,
            fabricIn: true,
            fabricOut: true,
            fabricUnit: true,
            defectivePieces: true,
            defectiveShelfLocation: true,
            defectReason: true,
            items: true,
          },
        },
        defects: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        issuedBy: { select: { id: true, username: true, fullName: true } },
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    return NextResponse.json(challan);
  } catch (error: any) {
    console.error('Error fetching challan:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch challan' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Permanent deletion is an Admin-only, audited action with a stated reason.
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  const reason = readReason(await request.json().catch(() => ({})));
  if (!reason) return reasonRequiredResponse();
  try {
    const { id } = await params;

    const challan = await prisma.challan.findUnique({
      where: { id },
      select: { id: true, challanNumber: true, challanType: true, defectivePieces: true, status: true, fromDepartment: true, toDepartment: true, programId: true, items: { select: { fabricCode: true, colour: true, quantity: true, uom: true } } },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    if (
      challan &&
      isFabricStoreDepartment(challan.fromDepartment) &&
      challan.toDepartment.toUpperCase() !== 'STORE' &&
      !['DRAFT', 'CANCELLED'].includes(challan.status.toUpperCase())
    ) {
      return NextResponse.json({ error: 'This Fabric Store challan still counts against stock. Cancel it first so the stock reversal is recorded.' }, { status: 409 });
    }

    const linkedDefectCount = await prisma.defectRecord.count({ where: { challanId: id } });
    if (linkedDefectCount > 0 || Number(challan.defectivePieces || 0) > 0 || ['DEFECT_RETURN', 'DEFECTIVE_RETURN'].includes(challan.challanType)) {
      return NextResponse.json({ error: 'A challan linked to defective material cannot be deleted. Use the authorized defective shelf disposition workflow.' }, { status: 409 });
    }

    // Cascade delete all dependencies safely in transaction
    await prisma.$transaction(
      async (tx) => {
        // 1. Unlink any child challans that reference this challan as parent
        await tx.challan.updateMany({
          where: { parentChallanId: id },
          data: { parentChallanId: null },
        });

        // 2. Unlink or clean up DyeingOrder references
        await tx.dyeingOrder.updateMany({
          where: { inboundChallanId: id },
          data: { inboundChallanId: null },
        });
        await tx.dyeingOrder.updateMany({
          where: { dyeingQcChallanId: id },
          data: { dyeingQcChallanId: null },
        });

        // 3. Delete production transactions referencing this challan
        await tx.productionTransaction.deleteMany({
          where: { challanId: id },
        });

        // 4. Delete quality inspections (clean up children first)
        const chInspections = await tx.qualityInspection.findMany({
          where: { challanId: id },
          select: { id: true },
        });
        const chInspectionIds = chInspections.map((i) => i.id);
        if (chInspectionIds.length > 0) {
          await tx.defectLog.deleteMany({
            where: { inspectionId: { in: chInspectionIds } },
          });
          await tx.qualityInspectionParameter.deleteMany({
            where: { inspectionId: { in: chInspectionIds } },
          });
        }
        await tx.qualityInspection.deleteMany({
          where: { challanId: id },
        });

        // 5. Delete defect records
        await tx.defectRecord.deleteMany({
          where: { challanId: id },
        });

        // 6. Delete bundles (clear cartonBundle first)
        const chBundles = await tx.bundle.findMany({
          where: { challanId: id },
          select: { id: true },
        });
        const chBundleIds = chBundles.map((b) => b.id);
        if (chBundleIds.length > 0) {
          await tx.cartonBundle.deleteMany({
            where: { bundleId: { in: chBundleIds } },
          });
        }
        await tx.bundle.deleteMany({
          where: { challanId: id },
        });

        // 7. Delete challan items & events
        await tx.challanItem.deleteMany({
          where: { challanId: id },
        });
        await tx.challanEvent.deleteMany({
          where: { challanId: id },
        });


        // 9. Permanently delete the challan record from PostgreSQL
        await tx.challan.delete({
          where: { id },
        });
        await auditAdminAction(request, auth.actor.id, 'CHALLAN_DELETED', 'Challan', id, {
          before: { challanNumber: challan.challanNumber, status: challan.status, fromDepartment: challan.fromDepartment, toDepartment: challan.toDepartment, programId: challan.programId, items: challan.items },
          after: { reason },
        }, tx);
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      message: `Challan ${challan.challanNumber} permanently deleted from database.`,
    });
  } catch (error: any) {
    console.error('Error permanently deleting challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete challan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      remarks,
      toDepartment,
      fromDepartment,
      fabricIn,
      fabricOut,
      fabricUnit,
      defectivePieces,
      defectiveShelfLocation,
      defectReason,
    } = body;

    const currentChallan = await prisma.challan.findUnique({ where: { id }, include: { program: true, items: true } });
    if (!currentChallan) return NextResponse.json({ error: 'Challan not found.' }, { status: 404 });

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'RECEIVED') {
        updateData.receivedDate = new Date();
      } else if (status === 'COMPLETED') {
        updateData.completedDate = new Date();
      }
    }
    if (remarks !== undefined) updateData.remarks = remarks;
    if (toDepartment) updateData.toDepartment = toDepartment;

    // Delivery deadline change: only the issuing or receiving department (or an admin), audited.
    let deliveryDateChange: { actorId: string; before: Date | null; after: Date | null } | null = null;
    if (Object.prototype.hasOwnProperty.call(body, 'deliveryDate')) {
      const nextDeliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
      if (body.deliveryDate && Number.isNaN(nextDeliveryDate!.getTime())) {
        return NextResponse.json({ error: 'Delivery Date is not a valid date.', field: 'deliveryDate' }, { status: 400 });
      }
      const auth = await getDefectiveShelfActor(request);
      if (!auth.actor) return auth.response;
      const actorDepartment = normalizeShelfDepartment(auth.actor.departmentCode);
      const allowed = auth.actor.isAdmin || [currentChallan.fromDepartment, currentChallan.toDepartment].includes(actorDepartment || '');
      if (!allowed) {
        return NextResponse.json({ error: 'Only the issuing or receiving department can change this delivery date.' }, { status: 403 });
      }
      const issued = currentChallan.issuedDate || currentChallan.createdAt;
      if (nextDeliveryDate && nextDeliveryDate.toISOString().slice(0, 10) < issued.toISOString().slice(0, 10)) {
        return NextResponse.json({ error: 'Delivery Date cannot be before the Challan Date.', field: 'deliveryDate' }, { status: 400 });
      }
      updateData.deliveryDate = nextDeliveryDate;
      deliveryDateChange = { actorId: auth.actor.id, before: currentChallan.deliveryDate, after: nextDeliveryDate };
    }
    if (fromDepartment) updateData.fromDepartment = fromDepartment;

    if (fabricIn !== undefined && fabricIn !== null) updateData.fabricIn = Number(fabricIn);
    if (fabricUnit !== undefined) updateData.fabricUnit = fabricUnit;
    let defectReporter: { id: string; fullName: string } | null = null;
    let defectDepartment: string | null = null;
    let defectColor: string | null = null;
    let defectFabricType: string | null = null;
    if (defectivePieces !== undefined && defectivePieces !== null) {
      const quantity = Number(defectivePieces);
      if (!Number.isFinite(quantity) || quantity < 0) return NextResponse.json({ error: 'Defective quantity must be zero or greater.' }, { status: 400 });
      if (quantity < Number(currentChallan.defectivePieces || 0)) {
        return NextResponse.json({ error: 'Defective quantity cannot be reduced here. Use the authorized disposition workflow.' }, { status: 409 });
      }
      updateData.defectivePieces = quantity;
      if (quantity > 0) {
        defectDepartment = normalizeShelfDepartment(fromDepartment || currentChallan.fromDepartment);
        if (!defectDepartment || !DEFECTIVE_SHELF_INFO[defectDepartment as keyof typeof DEFECTIVE_SHELF_INFO]) {
          return NextResponse.json({ error: 'This department does not have a departmental defective shelf.' }, { status: 400 });
        }
        const submittedReason = String(defectReason || '').trim();
        const existingReason = String(currentChallan.defectReason || '').trim();
        const requiresNewReason = quantity > Number(currentChallan.defectivePieces || 0) || !existingReason;
        if (requiresNewReason && !submittedReason) return NextResponse.json({ error: 'Reason for defect is required before sending material to a defective shelf.' }, { status: 400 });
        defectColor = currentChallan.items[0]?.colour || currentChallan.program?.fabricColor || null;
        defectFabricType = currentChallan.program?.fabricType || currentChallan.program?.fabricName || currentChallan.items[0]?.fabricCode || null;
        if (!defectColor || !defectFabricType) return NextResponse.json({ error: 'Color and fabric type must be recorded on the production sheet or challan before reporting a defect.' }, { status: 400 });
        const auth = await authorizeDefectReport(request, defectDepartment);
        if (!auth.actor) return auth.response;
        defectReporter = { id: auth.actor.id, fullName: auth.actor.fullName };
        updateData.defectiveShelfLocation = DEFECTIVE_SHELF_INFO[defectDepartment as keyof typeof DEFECTIVE_SHELF_INFO].code;
        updateData.defectReason = submittedReason || existingReason;
      }
    }
    if (fabricOut !== undefined && fabricOut !== null) {
      updateData.fabricOut = Number(fabricOut);
    } else if (updateData.fabricIn !== undefined && updateData.defectivePieces !== undefined) {
      updateData.fabricOut = Math.max(0, updateData.fabricIn - updateData.defectivePieces);
    }

    const stockActorId = await resolveStockActorId(request);

    const updated = await prisma.$transaction(async (tx) => {
      // Moving a Fabric Store challan into or out of DRAFT / CANCELLED changes stock.
      const finishStockChange = await guardStoreChallanStatusChange(tx, currentChallan, status, stockActorId);
      const ch = await tx.challan.update({
        where: { id },
        data: updateData,
        include: {
          program: true,
          items: true,
          fromDeptRel: true,
          toDeptRel: true,
        },
      });

      // Keep one traceable shelf record for this challan and department.
      if (updateData.defectivePieces && updateData.defectivePieces > 0 && defectReporter && defectDepartment) {
        const quantityUnit = updateData.fabricUnit || ch.fabricUnit || ch.items[0]?.uom || 'PCS';
        const defectData = {
          programId: ch.programId,
          challanId: ch.id,
          departmentCode: defectDepartment,
          shelfCode: DEFECTIVE_SHELF_INFO[defectDepartment as keyof typeof DEFECTIVE_SHELF_INFO].code,
          color: defectColor,
          fabricType: defectFabricType,
          quantityUnit,
          productionSheetNumber: ch.program?.programSerialNo || ch.program?.programNumber,
          responsibleIncharge: defectReporter.fullName,
          itemDescription: `Defective material reported from ${defectDepartment}`,
          severity: 'MAJOR',
          quantity: updateData.defectivePieces,
          reason: updateData.defectReason,
          detectedById: defectReporter.id,
          status: 'OPEN',
          resolutionNotes: `Quarantined on ${DEFECTIVE_SHELF_INFO[defectDepartment as keyof typeof DEFECTIVE_SHELF_INFO].code}; disposition requires authorized workflow.`,
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

    if (deliveryDateChange && (deliveryDateChange.before?.getTime() ?? null) !== (deliveryDateChange.after?.getTime() ?? null)) {
      await prisma.auditLog.create({
        data: {
          actorId: deliveryDateChange.actorId,
          action: 'CHALLAN_DELIVERY_DATE_CHANGED',
          entity: 'Challan',
          entityId: id,
          beforeState: JSON.stringify({ deliveryDate: deliveryDateChange.before }),
          afterState: JSON.stringify({ deliveryDate: deliveryDateChange.after }),
        },
      });
      // Recalculate the reminder schedule now rather than waiting for the next scheduled run.
      const department = normalizeShelfDepartment(updated.toDepartment);
      if (department && isAlertDepartmentActive(department)) {
        await syncDepartmentAlerts(department).catch((err) => console.warn('[deadline-alerts] Re-sync after deadline change failed:', err));
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof StockChangeError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error updating challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update challan' },
      { status: 500 }
    );
  }
}

