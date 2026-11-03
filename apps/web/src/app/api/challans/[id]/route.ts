import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';
import { canUpdateChallan } from '@/lib/auth/department-access';
import { errorResponse, workflowReceiving } from '@/lib/work-items-server';
import { deleteChallanAsAdmin } from '@/lib/admin-delete-server';
import { checkChallanStatusChange } from '@/lib/challan-status-server';
import { ConflictError, claimChallan } from '@/lib/record-claim';
import { MIXED_UNIT, unitOf } from '@/lib/challan-units.mjs';
import { ITEMS_WITH_SOURCE } from '@/lib/challan-sheets.mjs';
import { challanEditOptions } from '@/lib/challan-edit-server';

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

    // What the signed-in user may edit (the edit endpoint checks every save again).
    const { user } = await requireUser(request);
    const editOptions = await challanEditOptions(challan as any, user ?? null).catch(() => null);

    return NextResponse.json({ ...challan, editOptions });
  } catch (error: any) {
    console.error('Error fetching challan:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch challan' }, { status: 500 });
  }
}

/**
 * DELETE { reason } (preview: GET /api/admin/challans/:id/delete-impact): an administrator deletes one challan.
 * Its Production Sheet and other challans stay; the quantity returns to the sending side, Fabric Store stock
 * returns to the store, and the receiving side's records of it are removed (lib/admin-delete-server.ts). Refused
 * while later work depends on it (the error names what to delete first).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, response: authResponse } = await requireUser(request, { admin: true });
  if (!authUser) return authResponse;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const deleted = await deleteChallanAsAdmin(id, body?.reason, authUser);
    return NextResponse.json({
      success: true,
      message: `Challan ${deleted.challanNumber} permanently deleted.`,
    });
  } catch (error: any) {
    if (error instanceof FabricStockError) return NextResponse.json(fabricStockErrorBody(error), { status: 409 });
    return errorResponse(error, 'Failed to delete the challan.');
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

