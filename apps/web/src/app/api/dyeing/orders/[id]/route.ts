import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { DYEING_ORDER_INCLUDE, TX_OPTIONS, dyeingErrorResponse, parseOptionalDate } from '@/lib/dyeing-server';
import { remainingToDye, validateProcessUpdate } from '@/lib/dyeing-workflow.mjs';

export const dynamic = 'force-dynamic';

// GET /api/dyeing/orders/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    const { id } = await params;
    const order = await prisma.dyeingOrder.findUnique({ where: { id }, include: DYEING_ORDER_INCLUDE });
    if (!order) return NextResponse.json({ error: 'Dyeing record not found.' }, { status: 404 });

    const productionLogs = await prisma.productionTransaction.findMany({
      where: { programId: order.programId, departmentCode: 'DYEING' },
      include: { operator: { select: { fullName: true, username: true } } },
      orderBy: { recordedAt: 'desc' },
      take: 50,
    });
    return NextResponse.json({ data: { ...order, productionLogs } });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to load the dyeing record.');
  }
}

/**
 * PATCH /api/dyeing/orders/[id]
 * Body (all optional): { status, dyedQuantity, dyedColor, colorCode, colorReviewNote, batchNumber,
 *   machineNumber, processRemarks, expectedCompletionDate }
 * dyedQuantity is the cumulative processed quantity. Status moves only through Pending, In Progress,
 * Completed and Ready for QC; transfers to QC set the "sent" statuses.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const existing = await prisma.dyeingOrder.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Dyeing record not found.' }, { status: 404 });

    const check = validateProcessUpdate(existing, body);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const expectedCompletionDate = parseOptionalDate(body.expectedCompletionDate);
    if (body.expectedCompletionDate && expectedCompletionDate === undefined) {
      return NextResponse.json({ error: 'Expected completion date is not a valid date.' }, { status: 400 });
    }
    const text = (v: unknown, max = 500) => (v === undefined ? undefined : String(v ?? '').trim().slice(0, max) || null);
    const now = new Date();
    const updatedFields = {
      ...existing,
      dyedQuantity: check.dyedQuantity,
    };

    const order = await prisma.$transaction(async (tx) => {
      // The record must not have changed since it was read (e.g. a QC transfer in between).
      const guard = await tx.dyeingOrder.updateMany({
        where: { id, updatedAt: existing.updatedAt },
        data: {
          status: check.status,
          dyedQuantity: check.dyedQuantity,
          undyedQuantity: remainingToDye(updatedFields),
          readyForQc1Quantity: Math.max(0, check.dyedQuantity - existing.sentToQc1Quantity),
          dyedColor: check.dyedColor,
          colorMismatch: check.colorMismatch,
          ...(check.reviewNow
            ? { colorReviewNote: String(body.colorReviewNote).trim().slice(0, 500), colorReviewedById: user.id, colorReviewedAt: now }
            : !check.colorMismatch || (body.dyedColor !== undefined && check.dyedColor !== existing.dyedColor)
            ? { colorReviewNote: null, colorReviewedById: null, colorReviewedAt: null }
            : {}),
          ...(body.colorCode !== undefined ? { colorCode: text(body.colorCode, 60) } : {}),
          ...(body.batchNumber !== undefined ? { batchNumber: text(body.batchNumber, 60) } : {}),
          ...(body.machineNumber !== undefined ? { machineNumber: text(body.machineNumber, 60) } : {}),
          ...(body.processRemarks !== undefined ? { processRemarks: text(body.processRemarks) } : {}),
          ...(expectedCompletionDate !== undefined ? { expectedCompletionDate } : {}),
          startedAt: existing.startedAt ?? (check.status !== 'RECEIVED' ? now : null),
          completedAt: ['DYED', 'READY_FOR_QC1', 'PARTIALLY_SENT_TO_QC1'].includes(check.status)
            ? existing.completedAt ?? now
            : null,
        },
      });
      if (guard.count !== 1) {
        throw Object.assign(new Error('stale'), { stale: true });
      }

      if (check.dyedQuantity !== existing.dyedQuantity && existing.inboundChallanId) {
        await tx.productionTransaction.create({
          data: {
            programId: existing.programId,
            challanId: existing.inboundChallanId,
            departmentCode: 'DYEING',
            operationName: 'FABRIC_DYEING',
            operatorId: user.id,
            machineId: text(body.machineNumber, 60) ?? existing.machineNumber,
            inputQuantity: check.dyedQuantity - existing.dyedQuantity,
            goodQuantity: check.dyedQuantity,
            balanceQuantity: remainingToDye(updatedFields),
            unitOfMeasure: existing.uom,
            notes: `${existing.orderNumber}: processed ${existing.dyedQuantity} -> ${check.dyedQuantity} ${existing.uom}`,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'DYEING_UPDATE',
          entity: 'DyeingOrder',
          entityId: id,
          beforeState: JSON.stringify({
            status: existing.status,
            dyedQuantity: existing.dyedQuantity,
            dyedColor: existing.dyedColor,
            expectedCompletionDate: existing.expectedCompletionDate,
          }),
          afterState: JSON.stringify({
            status: check.status,
            dyedQuantity: check.dyedQuantity,
            dyedColor: check.dyedColor,
            colorMismatch: check.colorMismatch,
            colorReviewNote: check.reviewNow ? body.colorReviewNote : undefined,
          }),
        },
      });
      return tx.dyeingOrder.findUnique({ where: { id }, include: DYEING_ORDER_INCLUDE });
    }, TX_OPTIONS);

    return NextResponse.json({ data: order });
  } catch (error) {
    if ((error as { stale?: boolean } | null)?.stale) {
      return NextResponse.json({ error: 'This record was changed by someone else. Refresh and try again.' }, { status: 409 });
    }
    return dyeingErrorResponse(error, 'Failed to update the dyeing record.');
  }
}
