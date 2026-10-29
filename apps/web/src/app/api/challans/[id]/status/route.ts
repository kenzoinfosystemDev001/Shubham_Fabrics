import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';
import { canUpdateChallan } from '@/lib/auth/department-access';
import { workflowReceiving } from '@/lib/work-items-server';
import { challanTotalsByUnit, unitOf } from '@/lib/challan-units.mjs';

import {
  FabricStockError,
  STOCK_TRANSACTION_OPTIONS,
  fabricStockErrorBody,
  syncChallanStock,
} from '@/lib/fabric-stock-ledger';

export const dynamic = 'force-dynamic';

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
      notes,
      fabricIn,
      fabricOut,
      fabricUnit,
      defectivePieces,
      defectiveUnit,
      defectiveShelfLocation,
      defectReason,
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

    if (!canUpdateChallan(authUser, existing, status)) {
      return NextResponse.json(
        { error: 'Only the sending or receiving department can update this challan.' },
        { status: 403 }
      );
    }

    // Work-item departments record what each line actually received (shortages, excess) on their own screen.
    const receivingFlow = status === 'RECEIVED' ? workflowReceiving(existing) : null;
    if (receivingFlow) {
      return NextResponse.json(
        { error: `Receive this challan from ${receivingFlow.label} > My Work > Incoming Challans so each line's received quantity is recorded.` },
        { status: 409 }
      );
    }

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === 'RECEIVED') {
        data.receivedDate = new Date();
        data.receivedById = authUser.id;
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
      // Lines in both units have no single "in" quantity: the header stays empty, the lines hold it.
      const totals = challanTotalsByUnit({ ...existing, fabricOut: null, fabricIn: null });
      const units = Object.keys(totals);
      if (units.length === 1) data.fabricIn = totals[units[0]];
      else if (units.length === 0) data.fabricIn = Number(existing.program?.targetQuantity || 0);
    }

    if (fabricUnit !== undefined) data.fabricUnit = fabricUnit;

    if (defectivePieces !== undefined && defectivePieces !== null) {
      data.defectivePieces = Number(defectivePieces);
      // The defective quantity keeps its own unit (a MIXED challan has no single header unit).
      data.defectiveUnit = Number(defectivePieces) > 0 ? unitOf(defectiveUnit) || unitOf(fabricUnit) || unitOf(existing.defectiveUnit) || unitOf(existing.fabricUnit) || null : null;
      if (Number(defectivePieces) > 0) {
        data.defectiveShelfLocation =
          defectiveShelfLocation ||
          `DEF-SHELF-${existing.toDepartment || existing.fromDepartment || 'STORE'}`;
        data.defectReason = defectReason || 'Quality Defect / Trimming Rejection';
      }
    }

    if (fabricOut !== undefined && fabricOut !== null) {
      data.fabricOut = Number(fabricOut);
    } else if (data.fabricIn !== undefined && data.defectivePieces !== undefined) {
      data.fabricOut = Math.max(0, data.fabricIn - data.defectivePieces);
    }

    const isDyeingReceive =
      status === 'RECEIVED' &&
      (existing.toDepartment === 'DYEING' || existing.toDepartment.toLowerCase().includes('dye'));

    // 2. Perform Transaction to update Challan and operational logs
    const updated = await prisma.$transaction(async (tx) => {
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

      // Cancelling (or reinstating) a Fabric Store challan returns (or re-issues) its stock.
      if (status && status !== existing.status) {
        await syncChallanStock(tx, id, authUser.id);
      }

      // Log ChallanEvent if status changed
      if (status && status !== existing.status) {
        const actor = { id: authUser.id };
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

      // Dyeing orders are not marked received here: Dyeing records the actual quantity per line
      // through POST /api/dyeing/challans/:id/receive.

      // If defective pieces cut, ensure DefectRecord is logged
      if (data.defectivePieces && data.defectivePieces > 0) {
        const actor = { id: authUser.id };
        if (actor) {
          try {
            await tx.defectRecord.create({
              data: {
                defectCode: `DEF-${ch.toDepartment || ch.fromDepartment}-${Date.now().toString().slice(-4)}`,
                programId: ch.programId,
                challanId: ch.id,
                departmentCode: ch.toDepartment || ch.fromDepartment,
                itemDescription: `Defective pieces cut in ${ch.toDepartment || ch.fromDepartment} — Stored in ${data.defectiveShelfLocation || 'DEF-SHELF-01'}`,
                severity: 'MAJOR',
                quantity: data.defectivePieces,
                uom: data.defectiveUnit,
                reason: data.defectReason || 'Quality Defect / Segregation',
                detectedById: actor.id,
                status: 'OPEN',
                resolutionNotes: `Defective ${data.defectivePieces} ${data.defectiveUnit || ch.defectiveUnit || ""} cut to ${data.defectiveShelfLocation || 'DEF-SHELF-01'}. Leftover ${data.fabricOut || ch.fabricOut} sent forward.`,
              },
            });
          } catch (e) {
            console.warn('Defect record log error:', e);
          }
        }
      }

      return ch;
    }, isDyeingReceive || status ? STOCK_TRANSACTION_OPTIONS : undefined);

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof FabricStockError) {
      return NextResponse.json(fabricStockErrorBody(error), { status: 400 });
    }
    console.error('Error updating challan status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update challan status' },
      { status: 500 }
    );
  }
}
