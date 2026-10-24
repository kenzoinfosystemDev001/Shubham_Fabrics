import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import {
  canManageShelfDepartment,
  getDefectiveShelfActor,
  isProgrammingActor,
} from '@/lib/defective-shelf';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await getDefectiveShelfActor(request);
    if (!auth.actor) return auth.response;
    if (isProgrammingActor(auth.actor)) {
      return NextResponse.json({ error: 'Programming Department cannot manage defective shelf entries.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.defectRecord.findUnique({
      where: { id },
      include: { challan: { select: { id: true, programId: true } } },
    });
    if (!existing) return NextResponse.json({ error: 'Defective shelf entry not found.' }, { status: 404 });
    if (!canManageShelfDepartment(auth.actor, existing.departmentCode)) {
      return NextResponse.json({ error: 'You can only manage your department defective shelf.' }, { status: 403 });
    }
    if (existing.shelfRemovedAt) {
      return NextResponse.json({ error: 'Removed defective shelf entries cannot be edited.' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const data: Record<string, any> = {};
    if (Object.prototype.hasOwnProperty.call(body, 'reason')) {
      const reason = String(body.reason || '').trim();
      if (!reason) return NextResponse.json({ error: 'Reason for defect is required.' }, { status: 400 });
      data.reason = reason;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'quantity')) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Defective quantity must be greater than zero.' }, { status: 400 });
      }
      data.quantity = quantity;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'quantityUnit')) {
      const unit = String(body.quantityUnit || '').toUpperCase();
      if (!['MTR', 'PCS'].includes(unit)) return NextResponse.json({ error: 'Quantity unit must be MTR or PCS.' }, { status: 400 });
      data.quantityUnit = unit;
    }
    for (const field of ['color', 'fabricType', 'itemDescription']) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = String(body[field] || '').trim();
        if (field !== 'itemDescription' && !value) {
          return NextResponse.json({ error: `${field === 'color' ? 'Color' : 'Fabric type'} is required.` }, { status: 400 });
        }
        data[field] = value || null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'productionSheetNumber')) {
      const sheetNumber = String(body.productionSheetNumber || '').trim();
      if (!sheetNumber) return NextResponse.json({ error: 'Production Sheet Number / Serial Number is required.' }, { status: 400 });
      const program = await prisma.program.findFirst({
        where: { OR: [{ id: sheetNumber }, { programSerialNo: sheetNumber }, { programNumber: sheetNumber }] },
        select: { id: true, programNumber: true, programSerialNo: true },
      });
      if (!program) return NextResponse.json({ error: `Production Sheet '${sheetNumber}' was not found.` }, { status: 404 });
      if (
        existing.challan &&
        !Object.prototype.hasOwnProperty.call(body, 'challanReference') &&
        existing.challan.programId !== program.id
      ) {
        return NextResponse.json({ error: 'Choose a challan from the selected production sheet or clear the challan reference.' }, { status: 400 });
      }
      data.programId = program.id;
      data.productionSheetNumber = program.programSerialNo || program.programNumber;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'challanReference')) {
      const reference = String(body.challanReference || '').trim();
      if (!reference) {
        data.challanId = null;
      } else {
        const challan = await prisma.challan.findFirst({
          where: { OR: [{ id: reference }, { challanNumber: reference }] },
          select: { id: true, programId: true },
        });
        if (!challan) return NextResponse.json({ error: `Challan '${reference}' was not found.` }, { status: 404 });
        if (challan.programId !== (data.programId || existing.programId)) {
          return NextResponse.json({ error: 'The challan does not belong to the selected production sheet.' }, { status: 400 });
        }
        data.challanId = challan.id;
      }
    }

    if (!Object.keys(data).length) return NextResponse.json({ error: 'No editable defective shelf fields were provided.' }, { status: 400 });
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.defectRecord.update({
        where: { id },
        data,
        include: {
          program: { select: { programNumber: true, programSerialNo: true, styleCode: true, fabricName: true, fabricType: true, fabricColor: true } },
          challan: { select: { id: true, challanNumber: true, fabricUnit: true, items: { take: 1 } } },
          detectedBy: { select: { id: true, fullName: true, username: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.actor!.id,
          action: 'DEFECT_SHELF_ENTRY_UPDATED',
          entity: 'DefectRecord',
          entityId: id,
          beforeState: JSON.stringify({
            productionSheetNumber: existing.productionSheetNumber,
            challanId: existing.challanId,
            color: existing.color,
            fabricType: existing.fabricType,
            quantity: existing.quantity,
            quantityUnit: existing.quantityUnit,
            reason: existing.reason,
            itemDescription: existing.itemDescription,
          }),
          afterState: JSON.stringify(data),
        },
      });
      return record;
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update defective shelf entry error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update defective shelf entry.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const auth = await getDefectiveShelfActor(request);
    if (!auth.actor) return auth.response;
    if (isProgrammingActor(auth.actor)) {
      return NextResponse.json({ error: 'Programming Department cannot manage defective shelf entries.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.defectRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Defective shelf entry not found.' }, { status: 404 });
    if (!canManageShelfDepartment(auth.actor, existing.departmentCode)) {
      return NextResponse.json({ error: 'You can only manage your department defective shelf.' }, { status: 403 });
    }
    if (existing.shelfRemovedAt) return NextResponse.json({ error: 'Entry has already been removed from the shelf.' }, { status: 409 });

    const body = await request.json().catch(() => ({}));
    const removalReason = String(body.removalReason || '').trim();
    if (!removalReason) return NextResponse.json({ error: 'A reason is required to remove an entry from the shelf.' }, { status: 400 });

    const removedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.defectRecord.update({
        where: { id },
        data: { shelfRemovedAt: removedAt, shelfRemovalReason: removalReason },
      });
      await tx.auditLog.create({
        data: {
          actorId: auth.actor!.id,
          action: 'DEFECT_SHELF_ENTRY_REMOVED',
          entity: 'DefectRecord',
          entityId: id,
          beforeState: JSON.stringify({ shelfRemovedAt: null, reason: existing.reason, quantity: existing.quantity }),
          afterState: JSON.stringify({ shelfRemovedAt: removedAt, shelfRemovalReason: removalReason }),
        },
      });
      return record;
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Remove defective shelf entry error:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove defective shelf entry.' }, { status: 500 });
  }
}
