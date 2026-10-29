import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { DyeingRequestError, TX_OPTIONS, dyeingErrorResponse } from '@/lib/dyeing-server';

export const dynamic = 'force-dynamic';

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * POST /api/dyeing/challans/:id/receive
 * Body: { lines: [{ orderId, receivedQuantity, remarks? }], remarks? }
 * Records what physically arrived for every line still awaiting receipt on this challan.
 * A line can be received once; repeating the request is rejected, not counted twice.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;

  const body = await request.json().catch(() => null);
  const lines: Array<{ orderId: string; receivedQuantity: unknown; remarks?: unknown }> = Array.isArray(body?.lines) ? body.lines : [];
  const challanRemarks = typeof body?.remarks === 'string' ? body.remarks.trim().slice(0, 500) : '';

  try {
    const { id } = await params;
    const challan = await prisma.challan.findUnique({
      where: { id },
      select: {
        id: true,
        challanNumber: true,
        toDepartment: true,
        status: true,
        dyeingInboundOrders: {
          select: { id: true, orderNumber: true, status: true, requiredQuantity: true, uom: true, fabricName: true, targetColor: true },
        },
      },
    });
    if (!challan || challan.toDepartment.toUpperCase() !== 'DYEING') {
      return NextResponse.json({ error: 'Challan not found for Dyeing.' }, { status: 404 });
    }
    if (['CANCELLED', 'REJECTED'].includes(challan.status)) {
      return NextResponse.json({ error: `Challan ${challan.challanNumber} is ${challan.status.toLowerCase()}.` }, { status: 409 });
    }

    const pending = challan.dyeingInboundOrders.filter((o) => o.status === 'AWAITING_RECEIPT');
    if (pending.length === 0) {
      return NextResponse.json({ error: `Challan ${challan.challanNumber} has already been received.` }, { status: 409 });
    }

    // Every pending line must be answered exactly once, with a quantity of zero or more.
    const byId = new Map(lines.map((l) => [l.orderId, l]));
    if (byId.size !== lines.length) return NextResponse.json({ error: 'A line is listed twice.' }, { status: 400 });
    const receipts = pending.map((order, index) => {
      const line = byId.get(order.id);
      if (!line) throw new DyeingRequestError(`Enter the received quantity for line ${index + 1} (${order.fabricName}).`);
      const qty = Number(line.receivedQuantity);
      if (!Number.isFinite(qty) || qty < 0) throw new DyeingRequestError(`Line ${index + 1}: received quantity must be zero or more.`);
      const received = round(qty);
      const difference = round(received - order.requiredQuantity);
      const note = typeof line.remarks === 'string' ? line.remarks.trim().slice(0, 300) : '';
      const discrepancy =
        difference < 0
          ? `Short by ${Math.abs(difference)} ${order.uom}`
          : difference > 0
          ? `Excess of ${difference} ${order.uom}`
          : null;
      return { order, received, difference, remarks: [discrepancy, note].filter(Boolean).join(' · ') || null };
    });
    if (lines.some((l) => !pending.some((o) => o.id === l.orderId))) {
      throw new DyeingRequestError('A line does not belong to this challan or was already received.', 409);
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const r of receipts) {
        // Only lines still awaiting receipt change, so a duplicate submission cannot receive twice.
        const result = await tx.dyeingOrder.updateMany({
          where: { id: r.order.id, status: 'AWAITING_RECEIPT' },
          data: {
            status: 'RECEIVED',
            receivedQuantity: r.received,
            undyedQuantity: r.received,
            receivedAt: now,
            receivedById: user.id,
            receiptRemarks: r.remarks,
          },
        });
        if (result.count !== 1) throw new DyeingRequestError(`${r.order.orderNumber} was received by someone else just now.`, 409);
      }

      const fromStatus = challan.status;
      if (!['RECEIVED', 'COMPLETED', 'CLOSED'].includes(fromStatus)) {
        await tx.challan.update({
          where: { id: challan.id },
          data: { status: 'RECEIVED', receivedDate: now, receivedById: user.id },
        });
      }
      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          fromStatus,
          toStatus: 'RECEIVED',
          action: 'RECEIVE',
          actorId: user.id,
          notes: challanRemarks || null,
          metadata: JSON.stringify(
            receipts.map((r) => ({
              orderNumber: r.order.orderNumber,
              expected: r.order.requiredQuantity,
              received: r.received,
              uom: r.order.uom,
              remarks: r.remarks,
            })),
          ),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'DYEING_RECEIVE',
          entity: 'Challan',
          entityId: challan.id,
          afterState: JSON.stringify({
            challanNumber: challan.challanNumber,
            lines: receipts.map((r) => ({ orderNumber: r.order.orderNumber, received: r.received, uom: r.order.uom, difference: r.difference })),
          }),
        },
      });
    }, TX_OPTIONS);

    const shortLines = receipts.filter((r) => r.difference !== 0).length;
    return NextResponse.json({
      message: `Challan ${challan.challanNumber} received${shortLines ? ` with ${shortLines} discrepanc${shortLines === 1 ? 'y' : 'ies'}` : ''}.`,
    });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to record the receipt.');
  }
}
