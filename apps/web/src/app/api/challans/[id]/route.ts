import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';
import { canUpdateChallan } from '@/lib/auth/department-access';
import { workflowReceiving } from '@/lib/work-items-server';
import { checkChallanStatusChange } from '@/lib/challan-status-server';
import { ConflictError, claimChallan } from '@/lib/record-claim';
import { MIXED_UNIT, unitOf } from '@/lib/challan-units.mjs';
import { ITEMS_WITH_SOURCE } from '@/lib/challan-sheets.mjs';
import { writeAuditLog } from '@/lib/audit-log';
import { destructiveAdminActionsDisabled } from '@/lib/auth/require-user';

import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  syncChallanStock,
} from '@/lib/fabric-stock-ledger';

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
        items: ITEMS_WITH_SOURCE,
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
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const { id } = await params;

    const challan = await prisma.challan.findUnique({
      where: { id },
      select: {
        id: true,
        challanNumber: true,
        status: true,
        fromDepartment: true,
        toDepartment: true,
        programId: true,
        _count: { select: { workTransfers: true, productionLogs: true, inspections: true } },
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    // A challan nothing has happened on yet (no line received, processed, inspected or issued from it) can be
    // removed to correct a mistake. Once work exists, deleting it would erase production history and leave the
    // sending department's counts wrong, so it needs the server's destructive-actions switch as well.
    const receivedLines = await prisma.departmentWorkItem.count({ where: { inboundChallanId: id, status: { not: 'AWAITING_RECEIPT' } } });
    const hasActivity =
      receivedLines > 0 ||
      challan._count.workTransfers > 0 ||
      challan._count.productionLogs > 0 ||
      challan._count.inspections > 0 ||
      !['DRAFT', 'ISSUED', 'IN_TRANSIT', 'CANCELLED'].includes(challan.status);
    if (hasActivity) {
      const disabled = destructiveAdminActionsDisabled();
      if (disabled) {
        return NextResponse.json(
          {
            error: `Challan ${challan.challanNumber} already has recorded work (${challan.status}). Deleting it would erase production history, so it is disabled on this server. Correct it from the department's screen instead.`,
          },
          { status: 403 },
        );
      }
    }

    // Cascade delete all dependencies safely in transaction
    await prisma.$transaction(
      async (tx) => {
        // 1. Unlink any child challans that reference this challan as parent
        await tx.challan.updateMany({
          where: { parentChallanId: id },
          data: { parentChallanId: null },
        });

        // 2. Department work items received on this challan go with it (their transfers cascade).
        await tx.departmentWorkItem.deleteMany({ where: { inboundChallanId: id } });

        // Unlink or clean up DyeingOrder references
        await tx.dyeingOrder.updateMany({
          where: { inboundChallanId: id },
          data: { inboundChallanId: null },
        });
        await tx.dyeingOrder.updateMany({
          where: { qc1ChallanId: id },
          data: { qc1ChallanId: null },
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

        // 7. Return any Fabric Store stock this challan issued, then delete items & events
        await syncChallanStock(tx, id, authUser.id, { removed: true });
        await tx.challanItem.deleteMany({
          where: { challanId: id },
        });
        await tx.challanEvent.deleteMany({
          where: { challanId: id },
        });

        // 8. Audit logs are kept: record the deletion itself, with what was removed.
        await writeAuditLog(tx, {
          actorId: authUser.id,
          action: 'CHALLAN_DELETED',
          entity: 'Challan',
          entityId: id,
          before: {
            challanNumber: challan.challanNumber,
            status: challan.status,
            fromDepartment: challan.fromDepartment,
            toDepartment: challan.toDepartment,
            programId: challan.programId,
            hadRecordedWork: hasActivity,
          },
        });

        // 9. Permanently delete the challan record from PostgreSQL
        await tx.challan.delete({
          where: { id },
        });
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
  const { user: authUser, response: authResponse } = await requireUser(request);
  if (!authUser) return authResponse;
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
      defectiveUnit,
      defectiveShelfLocation,
      defectReason,
    } = body;

    const current = await prisma.challan.findUnique({
      where: { id },
      select: {
        id: true,
        challanNumber: true,
        status: true,
        updatedAt: true,
        fromDepartment: true,
        toDepartment: true,
        challanType: true,
        fabricUnit: true,
        defectiveUnit: true,
        defectivePieces: true,
      },
    });
    if (!current) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }
    // Only the changes the generic route may make (receive, cancel before receipt, admin clean-up).
    const transition = await checkChallanStatusChange(current, status, authUser);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: transition.status });
    }
    const receivingFlow = status === 'RECEIVED' ? workflowReceiving(current) : null;
    if (receivingFlow) {
      return NextResponse.json(
        { error: `Receive this challan from ${receivingFlow.label} > My Work > Incoming Challans so each line's received quantity is recorded.` },
        { status: 409 }
      );
    }
    if (!canUpdateChallan(authUser, current, status)) {
      return NextResponse.json(
        { error: 'Only the sending or receiving department can update this challan.' },
        { status: 403 }
      );
    }
    if ((toDepartment || fromDepartment) && !authUser.isAdmin) {
      return NextResponse.json(
        { error: 'Only an administrator can change the departments on a challan.' },
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'RECEIVED') {
        updateData.receivedDate = new Date();
        updateData.receivedById = authUser.id;
      } else if (status === 'COMPLETED') {
        updateData.completedDate = new Date();
      }
    }
    if (remarks !== undefined) updateData.remarks = remarks;
    if (toDepartment) updateData.toDepartment = toDepartment;
    if (fromDepartment) updateData.fromDepartment = fromDepartment;

    if (fabricIn !== undefined && fabricIn !== null) updateData.fabricIn = Number(fabricIn);
    if (fabricUnit !== undefined && fabricUnit !== null) {
      // MTR, PCS, or MIXED (lines in both units); anything else would be read as the wrong unit later.
      const headerUnit = String(fabricUnit).toUpperCase() === MIXED_UNIT ? MIXED_UNIT : unitOf(fabricUnit);
      if (!headerUnit) return NextResponse.json({ error: 'Choose MTR or PCS for the challan quantity.' }, { status: 400 });
      updateData.fabricUnit = headerUnit;
    }
    if (defectivePieces !== undefined && defectivePieces !== null) {
      updateData.defectivePieces = Number(defectivePieces);
      // The defective quantity keeps its own unit (a MIXED challan has no single header unit).
      updateData.defectiveUnit = Number(defectivePieces) > 0 ? unitOf(defectiveUnit) || unitOf(fabricUnit) || unitOf(current?.defectiveUnit) || unitOf(current?.fabricUnit) || null : null;
      if (Number(defectivePieces) > 0 && !updateData.defectiveUnit) {
        return NextResponse.json({ error: 'Choose MTR or PCS for the defective quantity.' }, { status: 400 });
      }
      if (Number(defectivePieces) > 0) {
        const upDept = (fromDepartment || '').toUpperCase();
        let defaultDeptShelf = 'DEF-SHELF-STORE (Fabric Store Quarantined Shelf)';
        if (upDept.includes('QC1') || upDept.includes('DYEING QC') || upDept.includes('DYE QC'))
          defaultDeptShelf = 'DEF-SHELF-QC1 (Dyeing QC Defective Shelf)';
        else if (upDept.includes('DYE')) defaultDeptShelf = 'DEF-SHELF-DYEING (Dyeing Station Defective Shelf)';
        else if (upDept.includes('EMB')) defaultDeptShelf = 'DEF-SHELF-EMBROIDERY (Embroidery Station Defective Shelf)';
        else if (upDept.includes('QC2') || upDept.includes('THREAD CUT QC') || upDept.includes('THREAD CUTTING QC'))
          defaultDeptShelf = 'DEF-SHELF-QC2 (Threadcut QC Defective Shelf)';
        else if (upDept.includes('THREAD') || upDept.includes('CUTTING') || upDept.includes('THC'))
          defaultDeptShelf = 'DEF-SHELF-THREAD-CUTTING (Thread Cutting Trimming Shelf)';
        else if (upDept.includes('QC3') || upDept.includes('WASHING QC') || upDept.includes('WASH QC'))
          defaultDeptShelf = 'DEF-SHELF-QC3 (Washing QC Defective Shelf)';
        else if (upDept.includes('FINAL') || upDept.includes('FINAL_CHECK') || upDept.includes('FINAL CHECK'))
          defaultDeptShelf = 'DEF-SHELF-FINAL-CHECK (Final check Defective Shelf)';

        updateData.defectiveShelfLocation =
          defectiveShelfLocation || defaultDeptShelf;
        updateData.defectReason = defectReason || 'Quality Defect / Trimming Rejection';
      }
    }
    if (fabricOut !== undefined && fabricOut !== null) {
      updateData.fabricOut = Number(fabricOut);
    } else if (updateData.fabricIn !== undefined && updateData.defectivePieces !== undefined) {
      updateData.fabricOut = Math.max(0, updateData.fabricIn - updateData.defectivePieces);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Re-check atomically that nobody changed the challan since it was read (double submit, second tablet).
      await claimChallan(tx, current);
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

      // Every status change is recorded on the challan's history.
      if (status && status !== current.status) {
        await tx.challanEvent.create({
          data: {
            challanId: id,
            fromStatus: current.status,
            toStatus: status,
            action: status === 'RECEIVED' ? 'RECEIVE' : status === 'CANCELLED' ? 'CANCEL' : 'STATUS_CHANGE',
            actorId: authUser.id,
            notes: typeof remarks === 'string' && remarks.trim() ? remarks.trim().slice(0, 500) : `Challan ${ch.challanNumber} status changed to ${status}`,
          },
        });
      }

      // Cancelling (or reinstating) a Fabric Store challan returns (or re-issues) its stock;
      // the ledger reconcile posts only the difference, so repeated updates change nothing.
      if (status) {
        await syncChallanStock(tx, id, authUser.id);
      }

      // If defective pieces were cut, ensure DefectRecord exists or is logged
      // Log only an increase in defective pieces (repeating the same value adds nothing).
      if (updateData.defectivePieces && updateData.defectivePieces > (Number(current.defectivePieces) || 0)) {
        const actor = { id: authUser.id };
        if (actor) {
          try {
            await tx.defectRecord.create({
              data: {
                defectCode: `DEF-${ch.fromDepartment}-${Date.now().toString().slice(-4)}`,
                programId: ch.programId,
                challanId: ch.id,
                departmentCode: ch.fromDepartment,
                itemDescription: `Defective pieces cut in ${ch.fromDepartment} — Stored in ${updateData.defectiveShelfLocation || 'DEF-SHELF-01'}`,
                severity: 'MAJOR',
                quantity: updateData.defectivePieces - (Number(current.defectivePieces) || 0),
                uom: updateData.defectiveUnit,
                reason: updateData.defectReason || 'Quality Defect / Segregation',
                detectedById: actor.id,
                status: 'OPEN',
                resolutionNotes: `Defective ${updateData.defectivePieces} ${updateData.defectiveUnit || ch.defectiveUnit || ""} cut to ${updateData.defectiveShelfLocation || 'DEF-SHELF-01'}. Leftover ${updateData.fabricOut || ch.fabricOut} sent forward.`,
              },
            });
          } catch (e) {
            console.warn('Defect record log error:', e);
          }
        }
      }

      return ch;
    }, status ? STOCK_TRANSACTION_OPTIONS : undefined);

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof FabricStockError) {
      return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    }
    console.error('Error updating challan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update challan' },
      { status: 500 }
    );
  }
}

