import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireUser } from '@/lib/auth/require-user';
import { canUpdateChallan } from '@/lib/auth/department-access';

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
      const itemsQty = existing.items.reduce(
        (sum, it) => sum + (Number(it.quantity) || 0),
        0
      );
      data.fabricIn = itemsQty > 0 ? itemsQty : Number(existing.program?.targetQuantity || 0);
    }

    if (fabricUnit !== undefined) data.fabricUnit = fabricUnit;

    if (defectivePieces !== undefined && defectivePieces !== null) {
      data.defectivePieces = Number(defectivePieces);
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
                quantity: Math.max(1, Math.round(data.defectivePieces)),
                reason: data.defectReason || 'Quality Defect / Segregation',
                detectedById: actor.id,
                status: 'OPEN',
                resolutionNotes: `Defective ${data.defectivePieces} ${data.fabricUnit || ch.fabricUnit || 'PCS'} cut to ${data.defectiveShelfLocation || 'DEF-SHELF-01'}. Leftover ${data.fabricOut || ch.fabricOut} sent forward.`,
              },
            });
          } catch (e) {
            console.warn('Defect record log error:', e);
          }
        }
      }

      return ch;
    }, isDyeingReceive ? { maxWait: 15000, timeout: 30000 } : undefined);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating challan status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update challan status' },
      { status: 500 }
    );
  }
}
