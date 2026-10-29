import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { assertChallanNumbersAvailable, challanNumberErrorResponse, requireChallanNumber } from '@/lib/challan-number-server';
import { DyeingRequestError, TX_OPTIONS, dyeingErrorResponse } from '@/lib/dyeing-server';
import { isColorMismatch, statusAfterTransfer, validateQcTransferLines } from '@/lib/dyeing-workflow.mjs';
import { MIXED_UNIT } from '@/lib/challan-units.mjs';
import { canStoreChallanAverage, canWriteColumns } from '@/lib/challan-item-average';

const ENDPOINT = 'DYEING_QC_CHALLAN';
const round = (n: number) => Math.round(n * 1000) / 1000;
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export interface QcTransferLineInput {
  orderId: string;
  quantity: unknown;
  actualDyedColor?: unknown;
  average?: unknown; // optional Average of the entry, with averageUnit (MTR | PCS)
  averageUnit?: unknown;
  remarks?: unknown;
}

export interface IssueQcChallanInput {
  idempotencyKey?: unknown;
  challanNumber: unknown;
  issuedDate?: unknown;
  priority?: unknown;
  remarks?: unknown;
  inchargeName?: unknown; // the Dyeing incharge name typed on the form
  lines: QcTransferLineInput[];
}

async function loadChallan(id: string) {
  return prisma.challan.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      program: { select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, deliveryDate: true } },
      parentChallan: { select: { id: true, challanNumber: true } },
      issuedBy: { select: { id: true, fullName: true, username: true } },
      dyeingQcTransfers: { include: { dyeingOrder: { select: { id: true, orderNumber: true, inboundChallanId: true } } } },
    },
  });
}

/**
 * Issues one Dyeing -> Dyeing QC (QC1) challan for several dyed lines of the same Production
 * Sheet. Each line moves only the quantity actually transferred, never more than is dyed and not
 * yet sent. Stock-like counters, the challan, its items and the transfer records are written in one
 * transaction; the same submission (idempotency key) is never applied twice.
 */
export async function issueDyeingQcChallan(user: AuthenticatedUser, input: IssueQcChallanInput) {
  let challanNumber = '';
  const key =
    typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim()
      ? `${ENDPOINT}:${user.id}:${input.idempotencyKey.trim().slice(0, 128)}`
      : null;

  const replay = async () => {
    if (!key) return null;
    const record = await prisma.idempotencyRecord.findUnique({ where: { key } });
    if (!record || record.endpoint !== ENDPOINT) return null;
    const { challanId } = JSON.parse(record.responseBody) as { challanId?: string };
    const challan = challanId ? await loadChallan(challanId) : null;
    return challan ? NextResponse.json({ data: challan, replayed: true }, { headers: { 'Idempotent-Replay': 'true' } }) : null;
  };

  try {
    const earlier = await replay();
    if (earlier) return earlier;

    challanNumber = requireChallanNumber(input.challanNumber);
    const lines = Array.isArray(input.lines) ? input.lines : [];
    const orders = await prisma.dyeingOrder.findMany({
      where: { id: { in: lines.map((l) => l.orderId) } },
      include: { program: { select: { id: true, programNumber: true, programSerialNo: true } } },
    });
    const byId = new Map(orders.map((o) => [o.id, o]));
    const check = validateQcTransferLines(lines, byId);
    if (!check.ok) throw new DyeingRequestError(check.error);

    // Base (original) colour of each line, from its Store -> Dyeing challan line.
    const inboundItemIds = orders.map((o) => o.inboundChallanItemId).filter((v): v is string => Boolean(v));
    const inboundItems = inboundItemIds.length
      ? await prisma.challanItem.findMany({ where: { id: { in: inboundItemIds } }, select: { id: true, colour: true } })
      : [];
    const baseColour = new Map(inboundItems.map((i) => [i.id, i.colour]));

    const prepared = lines.map((line, index) => {
      const order = byId.get(line.orderId)!;
      const typed = String(line.actualDyedColor ?? '').trim();
      const actual = typed || order.dyedColor || '';
      if (!actual) throw new DyeingRequestError(`Line ${index + 1}: enter the actual dyed colour.`);
      if (order.dyedColor && norm(actual) !== norm(order.dyedColor)) {
        throw new DyeingRequestError(
          `Line ${index + 1}: actual colour "${actual}" differs from the colour recorded in Dyeing Process ("${order.dyedColor}"). Update it there first.`,
        );
      }
      if (!order.dyedColor && isColorMismatch(order.targetColor, actual)) {
        throw new DyeingRequestError(
          `Line ${index + 1}: "${actual}" differs from the required colour "${order.targetColor}". Record and review it in Dyeing Process first.`,
        );
      }
      const rawAverage = line.average === undefined || line.average === null ? '' : String(line.average).trim();
      const average = rawAverage === '' ? null : Number(rawAverage);
      if (average !== null && (!Number.isFinite(average) || average < 0)) throw new DyeingRequestError(`Line ${index + 1}: Average must be 0 or more.`);
      const averageUnit = average === null ? null : String(line.averageUnit || '').toUpperCase();
      if (averageUnit !== null && averageUnit !== 'MTR' && averageUnit !== 'PCS') throw new DyeingRequestError(`Line ${index + 1}: choose MTR or PCS for the Average.`);
      return {
        order,
        average,
        averageUnit,
        quantity: round(Number(line.quantity)),
        actual,
        base: order.inboundChallanItemId ? baseColour.get(order.inboundChallanItemId) ?? null : null,
        remarks: typeof line.remarks === 'string' ? line.remarks.trim().slice(0, 300) : '',
      };
    });

    await assertChallanNumbersAvailable(prisma, 'DYEING', [{ value: challanNumber }]);
    const issuedDate = input.issuedDate ? new Date(String(input.issuedDate)) : new Date();
    if (Number.isNaN(issuedDate.getTime())) throw new DyeingRequestError('Challan date is not a valid date.');
    const priority = ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(String(input.priority)) ? String(input.priority) : prepared[0].order.priority;
    const total = round(prepared.reduce((s, p) => s + p.quantity, 0));
    const now = new Date();
    // Typed incharge name: its own column, or an "Incharge:" remarks note while that column is not in the database.
    const inchargeName = typeof input.inchargeName === 'string' ? input.inchargeName.trim().slice(0, 100) : '';
    const storeInchargeColumn = inchargeName ? await canWriteColumns('Challan', ['inchargeName']) : false;
    const storeAverage = prepared.some((p) => p.average !== null) ? await canStoreChallanAverage() : false;
    const userRemarks = typeof input.remarks === 'string' ? input.remarks.trim().slice(0, 500) : '';

    const challanId = await prisma.$transaction(async (tx) => {
      const challan = await tx.challan.create({
        data: {
          challanNumber,
          challanType: 'DYEING_TO_QC1',
          programId: check.programId,
          parentChallanId: prepared[0].order.inboundChallanId,
          fromDepartment: 'DYEING',
          toDepartment: 'QC1',
          status: 'ISSUED',
          priority,
          createdById: user.id,
          issuedById: user.id,
          issuedDate,
          fabricOut: check.unit === MIXED_UNIT ? null : total, // mixed units: totals come from the lines
          fabricUnit: check.unit,
          remarks:
            [userRemarks || null, inchargeName && !storeInchargeColumn ? `Incharge: ${inchargeName}` : null].filter(Boolean).join(' | ') || null,
          ...(storeInchargeColumn ? { inchargeName } : {}),
        },
      });

      // A record sent on several entries is updated once per entry, from what was sent before it.
      const sentBefore = new Map<string, number>();
      for (const p of prepared) {
        const was = sentBefore.get(p.order.id) ?? p.order.sentToQc1Quantity;
        const sentAfter = round(was + p.quantity);
        sentBefore.set(p.order.id, sentAfter);
        // Applies only if nothing changed since validation; otherwise another transfer won the race.
        const moved = await tx.dyeingOrder.updateMany({
          where: { id: p.order.id, sentToQc1Quantity: was, dyedQuantity: p.order.dyedQuantity },
          data: {
            sentToQc1Quantity: sentAfter,
            readyForQc1Quantity: Math.max(0, round(p.order.dyedQuantity - sentAfter)),
            status: statusAfterTransfer(p.order, sentAfter),
            sentToQc1At: now,
            qc1ChallanId: challan.id,
            ...(p.order.dyedColor ? {} : { dyedColor: p.actual }),
          },
        });
        if (moved.count !== 1) {
          throw new DyeingRequestError(`${p.order.fabricName} changed while this challan was being issued. Refresh and try again.`, 409);
        }

        const item = await tx.challanItem.create({
          data: {
            challanId: challan.id,
            itemDescription: `${p.order.fabricName} — ${p.actual}`,
            fabricCode: p.order.fabricName,
            colour: p.actual,
            requiredColour: p.order.targetColor || null,
            unitType: 'ROLL',
            quantity: p.quantity,
            uom: p.order.uom,
            ...(storeAverage && p.average !== null ? { average: p.average, averageUnit: p.averageUnit } : {}),
            remarks:
              [p.base ? `Base colour: ${p.base}` : null, `Dyeing ref: ${p.order.orderNumber}`, p.remarks || null]
                .filter(Boolean)
                .join(' · ') || null,
          },
        });
        await tx.dyeingQcTransfer.create({
          data: {
            dyeingOrderId: p.order.id,
            challanId: challan.id,
            challanItemId: item.id,
            quantity: p.quantity,
            uom: p.order.uom,
            actualDyedColor: p.actual,
            createdById: user.id,
          },
        });
        await tx.productionTransaction.create({
          data: {
            programId: p.order.programId,
            challanId: challan.id,
            departmentCode: 'DYEING',
            operationName: 'QC1_DISPATCH',
            operatorId: user.id,
            inputQuantity: p.quantity,
            goodQuantity: p.quantity,
            balanceQuantity: Math.max(0, round(p.order.dyedQuantity - sentAfter)),
            unitOfMeasure: p.order.uom,
            notes: `${p.order.orderNumber}: ${p.quantity} ${p.order.uom} to Dyeing QC on ${challanNumber}`,
          },
        });
      }

      await tx.challanEvent.create({
        data: {
          challanId: challan.id,
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          action: 'ISSUE',
          actorId: user.id,
          metadata: JSON.stringify(prepared.map((p) => ({ orderNumber: p.order.orderNumber, quantity: p.quantity, uom: p.order.uom, actualDyedColor: p.actual }))),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'DYEING_ISSUE_QC1',
          entity: 'Challan',
          entityId: challan.id,
          afterState: JSON.stringify({ challanNumber, total, unit: check.unit, lines: prepared.length }),
        },
      });
      if (key) {
        await tx.idempotencyRecord.create({
          data: { key, endpoint: ENDPOINT, method: 'POST', statusCode: 201, responseBody: JSON.stringify({ challanId: challan.id }) },
        });
      }
      return challan.id;
    }, TX_OPTIONS);

    return NextResponse.json({ data: await loadChallan(challanId) }, { status: 201 });
  } catch (error) {
    // A concurrent duplicate of this same submission lost the race: return the winner's challan.
    const earlier = await replay().catch(() => null);
    if (earlier) return earlier;
    const numberResponse = challanNumberErrorResponse(error, challanNumber);
    if (numberResponse) return numberResponse;
    return dyeingErrorResponse(error, 'Failed to issue the challan to Dyeing QC.');
  }
}
