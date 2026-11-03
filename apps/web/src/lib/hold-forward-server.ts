import { prisma } from '@shubham/database';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
import type { AuthenticatedUser } from '@/lib/auth/require-user';
import { assertChallanNumbersAvailable, ChallanNumberError, isDuplicateChallanNumberError, requireChallanNumber } from '@/lib/challan-number-server';
import { TX, WORKFLOWS, WorkRequestError, textOf, type WorkflowConfig } from '@/lib/work-items-server';
import { availableToProcess, readyToTransfer, receivedBasis, statusAfterTransfer } from '@/lib/work-items.mjs';
import {
  availableForQc,
  isColorMismatch,
  needsColorReview,
  receivedBasis as dyeingReceived,
  remainingToDye,
  statusAfterTransfer as dyeingStatusAfterTransfer,
} from '@/lib/dyeing-workflow.mjs';
import { garmentName } from '@/lib/finished-garments.mjs';
import { remainingOnHold, validateRelease } from '@/lib/holds.mjs';
import {
  actorNameOf,
  forwardRouteOf,
  loadLines,
  lockSource,
  originalLineOf,
  refreshHold,
  releaseKey,
  releasesOf,
  syncHeld,
  type HoldRow,
} from '@/lib/holds-server';
import { departmentName } from '@/lib/workflow-views';

// "Release and Forward": quantity released from a HOLD is sent on in the same transaction, on a new challan of
// the department's own next step (Dyeing -> Dyeing QC; Embroidery, Thread Cutting, Washing, Stitching, Finishing
// and Steam Press -> their next department). The challan is built the way the department's issue screen builds it
// (same challan type, typed challan number, the line's own Production Sheet and incoming line), so the receiving
// department gets it in its normal Incoming Challans and receives it as usual.
//
// Released HOLD quantity sits on the part of the line not yet processed (a HOLD rests there first), so it is
// recorded as processed here, with its own production record, before it leaves. Quantities stay in the line's own
// unit (MTR or PCS). Nothing is counted twice: the HOLD's released quantity, the line's heldQuantity, its processed
// and forwarded counters and the new challan all change together, guarded against concurrent changes.

const round = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

type Forwarded = { challanId: string; challanItemId: string; originalChallanItemId: string | null };

interface ForwardInput {
  hold: HoldRow;
  quantity: number;
  challanNumber: string;
  issuedDate: Date;
  dyedColour: string | null;
  remarks: string | null;
  user: AuthenticatedUser;
}

/** "Released from HOLD HLD-2026-0004 · Original challan CH-12": marks the new challan for the receiving department. */
const holdNote = (hold: HoldRow) => `Released from HOLD ${hold.holdNumber}${hold.challanNumber ? ` · Original challan ${hold.challanNumber}` : ''}`;

/** Work items (Embroidery, Thread Cutting, Washing, Stitching, Finishing, Steam Press) -> their next department. */
async function forwardWorkItem(tx: any, cfg: WorkflowConfig, f: ForwardInput): Promise<Forwarded> {
  const to = cfg.next!;
  const item = await tx.departmentWorkItem.findUnique({
    where: { id: f.hold.sourceId },
    include: { inboundChallan: { select: { challanNumber: true } }, sourceAllocation: { select: { allocationNumber: true } } },
  });
  if (!item || item.departmentCode !== cfg.code) throw new WorkRequestError('The held line was not found in this department.', 404);
  if (item.status === 'AWAITING_RECEIPT') throw new WorkRequestError('This line has not been received yet.', 409);

  // Released fabric is still unprocessed: record what this challan needs as processed (and, in production
  // departments, taken in), never beyond what was received less defective.
  const ready = readyToTransfer(item);
  const shortfall = round(Math.max(0, f.quantity - ready));
  if (shortfall > availableToProcess(item)) {
    throw new WorkRequestError(`Only ${round(ready + availableToProcess(item))} ${item.uom} of this line can be forwarded now.`, 409);
  }
  const processed = round(item.processedQuantity + shortfall);
  const taken = cfg.production ? round(Math.max(item.takenQuantity, processed + (item.defectQuantity || 0))) : item.takenQuantity;
  const worked = { ...item, processedQuantity: processed, takenQuantity: taken };
  if (round(processed + (item.defectQuantity || 0)) > receivedBasis(item) || readyToTransfer(worked) < f.quantity) {
    throw new WorkRequestError(`Only ${readyToTransfer(worked)} ${item.uom} of this line can be forwarded now.`, 409);
  }
  const transferred = round(item.transferredQuantity + f.quantity);
  const now = new Date();
  await tx.departmentWorkItem.update({
    where: { id: item.id },
    data: {
      processedQuantity: processed,
      takenQuantity: taken,
      transferredQuantity: transferred,
      status: statusAfterTransfer(worked, transferred),
      startedAt: item.startedAt ?? now,
      lastTransferredAt: now,
    },
  });

  const challan = await tx.challan.create({
    data: {
      challanNumber: f.challanNumber,
      challanType: to.challanType,
      programId: item.programId,
      parentChallanId: item.inboundChallanId,
      fromDepartment: cfg.code,
      toDepartment: to.code,
      status: 'ISSUED',
      priority: item.priority,
      createdById: f.user.id,
      issuedById: f.user.id,
      issuedDate: f.issuedDate,
      fabricOut: f.quantity,
      fabricUnit: item.uom,
      remarks: [holdNote(f.hold), f.remarks].filter(Boolean).join(' | '),
    },
  });
  const ci = await tx.challanItem.create({
    data: {
      challanId: challan.id,
      itemDescription: cfg.finishedGoods
        ? garmentName(item)
        : `${item.garmentCategory ? `${item.garmentCategory}${item.styleRef ? ` · ${item.styleRef}` : ''} — ` : ''}${item.fabricName} — ${item.colour || 'Colour not recorded'}`,
      fabricCode: item.fabricName,
      colour: item.colour,
      fabricProcessingStatus: item.fabricProcessingStatus,
      garmentCategory: item.garmentCategory,
      styleRef: item.styleRef,
      programId: item.programId,
      sourceChallanItemId: item.inboundChallanItemId,
      unitType: item.uom === 'PCS' ? 'PCS' : 'ROLL',
      quantity: f.quantity,
      uom: item.uom,
      // "Status:" keeps the convention the stock rules already read.
      remarks: [
        `Status: ${item.fabricProcessingStatus === 'DYED' ? 'Dyed' : 'Undyed'}`,
        `Incoming: ${item.inboundChallan.challanNumber}`,
        item.sourceAllocation ? `Allocation: ${item.sourceAllocation.allocationNumber}` : null,
        `HOLD release: ${f.hold.holdNumber}`,
      ]
        .filter(Boolean)
        .join(' · '),
    },
  });
  await tx.departmentWorkTransfer.create({
    data: { workItemId: item.id, challanId: challan.id, challanItemId: ci.id, quantity: f.quantity, uom: item.uom, fabricProcessingStatus: item.fabricProcessingStatus, kind: 'PASS', createdById: f.user.id },
  });
  if (taken !== item.takenQuantity) {
    await tx.productionTransaction.create({
      data: {
        programId: item.programId,
        challanId: item.inboundChallanId,
        departmentCode: cfg.code,
        operationName: `${cfg.code}_TAKE_IN`,
        operatorId: f.user.id,
        inputQuantity: round(taken - item.takenQuantity),
        goodQuantity: processed,
        balanceQuantity: Math.max(0, round(receivedBasis(item) - taken)),
        unitOfMeasure: item.uom,
        notes: `${item.itemNumber}: taken ${item.takenQuantity} -> ${taken} ${item.uom} (released from HOLD ${f.hold.holdNumber})`,
      },
    });
  }
  if (shortfall > 0) {
    await tx.productionTransaction.create({
      data: {
        programId: item.programId,
        challanId: item.inboundChallanId,
        departmentCode: cfg.code,
        operationName: `${cfg.code}_PROCESS`,
        operatorId: f.user.id,
        inputQuantity: shortfall,
        goodQuantity: processed,
        balanceQuantity: Math.max(0, round(receivedBasis(item) - processed)),
        unitOfMeasure: item.uom,
        notes: `${item.itemNumber}: processed ${item.processedQuantity} -> ${processed} ${item.uom} (released from HOLD ${f.hold.holdNumber})`,
      },
    });
  }
  await tx.productionTransaction.create({
    data: {
      programId: item.programId,
      challanId: challan.id,
      departmentCode: cfg.code,
      operationName: `${cfg.code}_TRANSFER`,
      operatorId: f.user.id,
      inputQuantity: f.quantity,
      goodQuantity: f.quantity,
      balanceQuantity: readyToTransfer({ ...worked, transferredQuantity: transferred }),
      unitOfMeasure: item.uom,
      notes: `${item.itemNumber}: ${f.quantity} ${item.uom} to ${to.label} on ${f.challanNumber} (released from HOLD ${f.hold.holdNumber})`,
    },
  });
  return { challanId: challan.id, challanItemId: ci.id, originalChallanItemId: item.inboundChallanItemId };
}

/** Dyeing orders -> Dyeing QC, the way the Dyeing QC challan screen issues them. */
async function forwardDyeingOrder(tx: any, f: ForwardInput): Promise<Forwarded> {
  const order = await tx.dyeingOrder.findUnique({ where: { id: f.hold.sourceId } });
  if (!order) throw new WorkRequestError('The held line was not found in Dyeing.', 404);
  if (order.status === 'AWAITING_RECEIPT') throw new WorkRequestError('This line has not been received yet.', 409);
  if (needsColorReview(order)) throw new WorkRequestError(`${order.fabricName} has an unreviewed colour difference. Review it in Dyeing Process first.`, 409);
  const colour = order.dyedColor || f.dyedColour || '';
  if (!colour) throw new WorkRequestError('Enter the actual dyed colour of the released fabric.');
  if (!order.dyedColor && isColorMismatch(order.targetColor, colour)) {
    throw new WorkRequestError(`"${colour}" differs from the required colour "${order.targetColor}". Record and review it in Dyeing Process first.`);
  }

  // Released fabric is still undyed: record what this challan needs as dyed (processed) before it leaves.
  const ready = availableForQc(order);
  const shortfall = round(Math.max(0, f.quantity - ready));
  if (shortfall > remainingToDye(order)) {
    throw new WorkRequestError(`Only ${round(ready + remainingToDye(order))} ${order.uom} of this line can be forwarded now.`, 409);
  }
  const dyed = round(order.dyedQuantity + shortfall);
  const worked = { ...order, dyedQuantity: dyed };
  if (dyed > dyeingReceived(order) || availableForQc(worked) < f.quantity) {
    throw new WorkRequestError(`Only ${availableForQc(worked)} ${order.uom} of this line can be forwarded now.`, 409);
  }
  const sentAfter = round(order.sentToQc1Quantity + f.quantity);
  const now = new Date();

  const challan = await tx.challan.create({
    data: {
      challanNumber: f.challanNumber,
      challanType: 'DYEING_TO_QC1',
      programId: order.programId,
      parentChallanId: order.inboundChallanId,
      fromDepartment: 'DYEING',
      toDepartment: 'QC1',
      status: 'ISSUED',
      priority: order.priority,
      createdById: f.user.id,
      issuedById: f.user.id,
      issuedDate: f.issuedDate,
      fabricOut: f.quantity,
      fabricUnit: order.uom,
      remarks: [holdNote(f.hold), f.remarks].filter(Boolean).join(' | '),
    },
  });
  await tx.dyeingOrder.update({
    where: { id: order.id },
    data: {
      dyedQuantity: dyed,
      undyedQuantity: Math.max(0, round(dyeingReceived(order) - dyed)),
      sentToQc1Quantity: sentAfter,
      readyForQc1Quantity: Math.max(0, round(dyed - sentAfter)),
      status: dyeingStatusAfterTransfer(worked, sentAfter),
      startedAt: order.startedAt ?? now,
      sentToQc1At: now,
      qc1ChallanId: challan.id,
      ...(order.dyedColor ? {} : { dyedColor: colour }),
    },
  });
  const base = order.inboundChallanItemId
    ? await tx.challanItem.findUnique({ where: { id: order.inboundChallanItemId }, select: { colour: true } })
    : null;
  const ci = await tx.challanItem.create({
    data: {
      challanId: challan.id,
      itemDescription: `${order.fabricName} — ${colour}`,
      fabricCode: order.fabricName,
      colour,
      requiredColour: order.targetColor || null,
      programId: order.programId,
      sourceChallanItemId: order.inboundChallanItemId,
      unitType: 'ROLL',
      quantity: f.quantity,
      uom: order.uom,
      remarks: [base?.colour ? `Base colour: ${base.colour}` : null, `Dyeing ref: ${order.orderNumber}`, `HOLD release: ${f.hold.holdNumber}`].filter(Boolean).join(' · '),
    },
  });
  await tx.dyeingQcTransfer.create({
    data: { dyeingOrderId: order.id, challanId: challan.id, challanItemId: ci.id, quantity: f.quantity, uom: order.uom, actualDyedColor: colour, createdById: f.user.id },
  });
  if (shortfall > 0 && order.inboundChallanId) {
    await tx.productionTransaction.create({
      data: {
        programId: order.programId,
        challanId: order.inboundChallanId,
        departmentCode: 'DYEING',
        operationName: 'FABRIC_DYEING',
        operatorId: f.user.id,
        inputQuantity: shortfall,
        goodQuantity: dyed,
        balanceQuantity: Math.max(0, round(dyeingReceived(order) - dyed)),
        unitOfMeasure: order.uom,
        notes: `${order.orderNumber}: processed ${order.dyedQuantity} -> ${dyed} ${order.uom} (released from HOLD ${f.hold.holdNumber})`,
      },
    });
  }
  await tx.productionTransaction.create({
    data: {
      programId: order.programId,
      challanId: challan.id,
      departmentCode: 'DYEING',
      operationName: 'QC1_DISPATCH',
      operatorId: f.user.id,
      inputQuantity: f.quantity,
      goodQuantity: f.quantity,
      balanceQuantity: Math.max(0, round(dyed - sentAfter)),
      unitOfMeasure: order.uom,
      notes: `${order.orderNumber}: ${f.quantity} ${order.uom} to Dyeing QC on ${f.challanNumber} (released from HOLD ${f.hold.holdNumber})`,
    },
  });
  return { challanId: challan.id, challanItemId: ci.id, originalChallanItemId: order.inboundChallanItemId };
}

/**
 * POST /api/holds/:id/release-forward  { quantity, challanNumber, issuedDate?, dyedColour?, remarks?, idempotencyKey }
 * Releases `quantity` from the HOLD and sends exactly that quantity on a new challan to the department's next step,
 * all in one transaction. A repeated submission (same idempotencyKey) returns the first result; the HOLD, the line
 * and the challan number are all guarded, so a double click never creates a second challan.
 */
export async function releaseAndForward(id: string, body: any, user: AuthenticatedUser) {
  const key = releaseKey(body, user);
  const replay = async () => {
    if (!key) return null;
    const done = await prisma.departmentHoldRelease.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    return done ? (await releasesOf({ id: done.id }, 1))[0] : null;
  };
  const earlier = await replay();
  if (earlier) return { release: earlier, replayed: true };

  const found = await prisma.departmentHold.findUnique({ where: { id } });
  if (!found) throw new WorkRequestError('HOLD record not found.', 404);
  if (!userBelongsToDepartment(user, found.departmentCode)) throw new WorkRequestError('You do not have access to this department.', 403);
  const route = forwardRouteOf(found.departmentCode);
  if ('reason' in route) throw new WorkRequestError(route.reason);
  const cfg = found.departmentCode === 'DYEING' ? null : (WORKFLOWS as Record<string, WorkflowConfig>)[found.departmentCode];
  if (found.sourceType !== (cfg ? 'WORK_ITEM' : 'DYEING_ORDER')) throw new WorkRequestError('This HOLD cannot be forwarded from here.');

  const line = (await loadLines(found.departmentCode, [found.sourceId])).find((l) => l.key === found.sourceKey);
  const hold = await refreshHold(found, line);
  const remaining = line ? remainingOnHold(hold, line) : hold.remainingQuantity;
  const check = validateRelease(hold, remaining, body);
  if (!check.ok) throw new WorkRequestError(check.error);
  if (hold.unit === 'PCS' && !Number.isInteger(check.quantity)) throw new WorkRequestError('Pieces are forwarded in whole numbers.');
  const challanNumber = requireChallanNumber(body?.challanNumber);
  await assertChallanNumbersAvailable(prisma, found.departmentCode, [{ value: challanNumber }]);
  const issuedDate = body?.issuedDate ? new Date(String(body.issuedDate)) : new Date();
  if (Number.isNaN(issuedDate.getTime())) throw new WorkRequestError('Challan date is not a valid date.');
  const remarks = check.remarks;
  const after = round(remaining - check.quantity);
  const original = await originalLineOf(hold);

  try {
    const releaseId = await prisma.$transaction(async (tx) => {
      // The line is locked first: an issue, inspection or HOLD on it at the same moment waits or fails its guard.
      await lockSource(tx, hold.sourceType, hold.sourceId);
      const res = await tx.departmentHold.updateMany({
        where: { id: hold.id, updatedAt: hold.updatedAt, status: { in: ['ON_HOLD', 'PARTIALLY_RELEASED', 'PARTIALLY_FORWARDED'] } },
        data: {
          releasedQuantity: round(hold.releasedQuantity + check.quantity),
          remainingQuantity: after,
          status: after <= 0 ? 'FORWARDED' : 'PARTIALLY_RELEASED',
          ...(after <= 0 ? { activeKey: null, closedAt: new Date() } : {}),
        },
      });
      if (res.count !== 1) throw new WorkRequestError('This HOLD was changed by someone else. Refresh and try again.', 409);
      // The released quantity leaves the HOLD before the line is checked, so it counts once: free, then forwarded.
      await syncHeld(tx, hold.sourceType, hold.sourceId);
      const input: ForwardInput = { hold, quantity: check.quantity, challanNumber, issuedDate, dyedColour: textOf(body?.dyedColour, 100), remarks, user };
      const sent = cfg ? await forwardWorkItem(tx, cfg, input) : await forwardDyeingOrder(tx, input);

      const event = await tx.departmentHoldEvent.create({
        data: {
          holdId: hold.id,
          action: 'RELEASE',
          quantity: check.quantity,
          remainingAfter: after,
          unit: hold.unit,
          remarks: [`Released and forwarded to ${route.toName} on challan ${challanNumber}`, remarks].filter(Boolean).join(' · '),
          actorId: user.id,
          actorName: actorNameOf(user),
        },
      });
      const release = await tx.departmentHoldRelease.create({
        data: {
          holdId: hold.id,
          departmentCode: hold.departmentCode,
          mode: 'FORWARD',
          quantity: check.quantity,
          unit: hold.unit,
          remainingAfter: after,
          programId: hold.programId,
          originalChallanId: hold.challanId,
          originalChallanNumber: hold.challanNumber,
          originalChallanItemId: sent.originalChallanItemId || original.challanItemId,
          newChallanId: sent.challanId,
          newChallanNumber: challanNumber,
          newChallanItemId: sent.challanItemId,
          destinationDepartment: route.to,
          eventId: event.id,
          idempotencyKey: key,
          remarks,
          releasedById: user.id,
          releasedByName: actorNameOf(user),
        },
      });
      await tx.challanEvent.create({
        data: {
          challanId: sent.challanId,
          fromStatus: 'DRAFT',
          toStatus: 'ISSUED',
          action: 'ISSUE',
          actorId: user.id,
          notes: holdNote(hold),
          metadata: JSON.stringify({ holdId: hold.id, holdNumber: hold.holdNumber, holdReleaseId: release.id, quantity: check.quantity, uom: hold.unit, originalChallanId: hold.challanId, originalChallanItemId: release.originalChallanItemId }),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'HOLD_RELEASE_FORWARD',
          entity: 'DepartmentHold',
          entityId: hold.id,
          beforeState: JSON.stringify({ remaining, released: hold.releasedQuantity, status: hold.status }),
          afterState: JSON.stringify({
            quantity: check.quantity,
            unit: hold.unit,
            remaining: after,
            challanId: sent.challanId,
            challanNumber,
            from: hold.departmentCode,
            to: route.to,
            originalChallanId: hold.challanId,
            originalChallanItemId: release.originalChallanItemId,
            programId: hold.programId,
          }),
        },
      });
      return release.id;
    }, TX);
    return { release: (await releasesOf({ id: releaseId }, 1))[0], replayed: false };
  } catch (error) {
    // A concurrent copy of this same submission won: return its result.
    const won = await replay().catch(() => null);
    if (won) return { release: won, replayed: true };
    if (isDuplicateChallanNumberError(error)) {
      throw new ChallanNumberError(`Challan Number ${challanNumber} is already used by ${departmentName(found.departmentCode)}. Enter a different number.`, 409);
    }
    throw error;
  }
}
