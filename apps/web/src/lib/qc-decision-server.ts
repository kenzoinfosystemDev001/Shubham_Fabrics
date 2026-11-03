import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { TX, WORK_ITEM_INCLUDE, WorkRequestError, guarded, round, textOf, type WorkflowConfig } from '@/lib/work-items-server';
import { availableToProcess, heldOf, qcStatusOf, receivedBasis } from '@/lib/work-items.mjs';
import { HOLD_REASONS } from '@/lib/holds.mjs';
import { addToHold, loadLines, lockSource, takeFromHold } from '@/lib/holds-server';
import { routeQcDecisions } from '@/lib/rework-routing-server';

// Changing a QC decision (Threadcut QC, Washing QC, Final QC): quantity recorded as REJECT, REWORK or HOLD is moved
// to another of the three, in whole or in part, without a new inspection. The inspection batch is corrected in
// place (REJECT <-> REWORK), quantity put on HOLD is taken off its batch and held on the line, and held quantity
// given REJECT / REWORK is recorded as that decision. The Defective Shelf and the rework task follow without a
// challan (lib/rework-routing-server.ts); REWORK the rework department has already started on, and quantity that
// left on a challan before decisions were routed directly, can no longer change. Every change is audited.
// Dyeing QC has its own (lib/qc1-decision-server.ts).

export type Decision = 'REJECT' | 'REWORK' | 'HOLD';
const DECISIONS: Decision[] = ['REJECT', 'REWORK', 'HOLD'];
const LABEL: Record<Decision, string> = { REJECT: 'REJECT', REWORK: 'REWORK', HOLD: 'HOLD' };
const decisionOf = (v: unknown): Decision => {
  const d = String(v || '').toUpperCase() as Decision;
  if (!DECISIONS.includes(d)) throw new WorkRequestError('Choose REJECT, REWORK or HOLD.');
  return d;
};

const auditAction = (cfg: WorkflowConfig) => `${cfg.code}_DECISION_CHANGED`;

/**
 * POST items/:id/decision  { from, to, quantity, inspectionId?, correctionReason, remarks?, reason?, holdReason?, holdReasonOther? }
 * from REJECT / REWORK needs the inspection batch it was recorded on. `reason` is the defect / rework reason of the
 * new decision (the batch's own is kept when blank); `holdReason` is required when the new decision is HOLD.
 * The same decision as before only updates the reason and remarks.
 */
export function changeDecision(request: Request, cfg: WorkflowConfig, itemId: string) {
  return guarded(request, cfg, async (user) => {
    if (!cfg.qc) throw new WorkRequestError(`${cfg.label} does not inspect.`, 404);
    const body = await request.json().catch(() => null);
    if (!body) throw new WorkRequestError('Invalid request.');
    const from = decisionOf(body.from);
    const to = decisionOf(body.to);
    const correctionReason = textOf(body.correctionReason, 300);
    if (!correctionReason) throw new WorkRequestError('Enter the reason for this correction.');
    const remarks = textOf(body.remarks, 500);
    const newReason = textOf(body.reason, 300);
    const quantity = round(Number(body.quantity));
    if (from !== to && (!Number.isFinite(quantity) || quantity <= 0)) throw new WorkRequestError('Enter the quantity whose decision changes (more than zero).');

    let holdCheck: { quantity: number; reason: string; reasonOther: string | null; remarks: string | null } | null = null;
    if (to === 'HOLD' && from !== 'HOLD') {
      const code = String(body.holdReason || '').toUpperCase();
      if (!HOLD_REASONS.some((r) => r.code === code)) throw new WorkRequestError('Select the Hold Reason.');
      const other = code === 'OTHER' ? textOf(body.holdReasonOther, 200) : null;
      if (code === 'OTHER' && !other) throw new WorkRequestError('Enter the reason for Other.');
      holdCheck = { quantity, reason: code, reasonOther: other, remarks };
    }

    const message = await prisma.$transaction(async (tx) => {
      await lockSource(tx, 'WORK_ITEM', itemId);
      const item = await tx.departmentWorkItem.findFirst({ where: { id: itemId, departmentCode: cfg.code } });
      if (!item) throw new WorkRequestError('Work item not found.', 404);
      const batch = from !== 'HOLD' || body.inspectionId ? await tx.workItemInspection.findFirst({ where: { id: String(body.inspectionId || ''), workItemId: item.id } }) : null;
      if (from !== 'HOLD' && !batch) throw new WorkRequestError('Choose the inspection whose decision changes.');
      const before = { inspected: item.processedQuantity, passed: item.passedQuantity, rejected: item.rejectedQuantity, rework: item.reworkQuantity, held: heldOf(item) };
      const batchBefore = batch && { inspected: batch.inspectedQuantity, pass: batch.passQuantity, reject: batch.rejectQuantity, rework: batch.reworkQuantity, rejectReason: batch.rejectReason, reworkReason: batch.reworkReason, remarks: batch.remarks };
      const field = (d: Decision) => (d === 'REJECT' ? 'rejectQuantity' : 'reworkQuantity') as 'rejectQuantity' | 'reworkQuantity';
      const itemField = (d: Decision) => (d === 'REJECT' ? 'rejectedQuantity' : 'reworkQuantity') as 'rejectedQuantity' | 'reworkQuantity';
      const reasonField = (d: Decision) => (d === 'REJECT' ? 'rejectReason' : 'reworkReason') as 'rejectReason' | 'reworkReason';
      const after = { ...item };
      let summary = '';

      // ------------------------------------------------ same decision: reason and remarks only
      if (from === to) {
        if (from === 'HOLD') throw new WorkRequestError('Choose a different decision for the held quantity.');
        const reason = newReason || batch![reasonField(from)];
        await tx.workItemInspection.update({ where: { id: batch!.id }, data: { [reasonField(from)]: reason, ...(remarks !== null ? { remarks } : {}) } });
        summary = `${LABEL[from]} kept; reason and remarks updated.`;
      } else {
        // ------------------------------------------------ the quantity leaving its decision
        if (from === 'REJECT' || from === 'REWORK') {
          const inBatch = round(batch![field(from)]);
          if (quantity > inBatch) throw new WorkRequestError(`This inspection recorded ${inBatch} ${item.uom} as ${LABEL[from]}; no more can change.`);
        } else if (quantity > heldOf(item)) {
          throw new WorkRequestError(`Only ${heldOf(item)} ${item.uom} of this line is on HOLD.`);
        }

        if (from !== 'HOLD' && to !== 'HOLD') {
          // REJECT <-> REWORK: the same inspected quantity, recorded under the other decision on the same batch.
          const reason = newReason || batch![reasonField(to)];
          if (!reason) throw new WorkRequestError(`Enter the ${to === 'REJECT' ? 'defect' : 'rework'} reason.`);
          const leftFrom = round(batch![field(from)] - quantity);
          await tx.workItemInspection.update({
            where: { id: batch!.id },
            data: {
              [field(from)]: leftFrom,
              [field(to)]: round(batch![field(to)] + quantity),
              [reasonField(to)]: reason,
              ...(leftFrom <= 0 ? { [reasonField(from)]: null } : {}),
              ...(remarks !== null ? { remarks } : {}),
            },
          });
          after[itemField(from)] = round(item[itemField(from)] - quantity);
          after[itemField(to)] = round(item[itemField(to)] + quantity);
        } else if (to === 'HOLD') {
          // REJECT / REWORK -> HOLD: the quantity is no longer decided; it is taken off the batch and held on the line.
          const leftFrom = round(batch![field(from)] - quantity);
          await tx.workItemInspection.update({
            where: { id: batch!.id },
            data: {
              inspectedQuantity: round(batch!.inspectedQuantity - quantity),
              [field(from)]: leftFrom,
              ...(leftFrom <= 0 ? { [reasonField(from)]: null } : {}),
              ...(remarks !== null ? { remarks } : {}),
            },
          });
          after.processedQuantity = round(item.processedQuantity - quantity);
          after[itemField(from)] = round(item[itemField(from)] - quantity);
        } else {
          // HOLD -> REJECT / REWORK: the held quantity gets that decision. Uninspected held quantity is recorded as a
          // new inspection batch; held quantity that had passed moves from PASS on the latest batches.
          const reason = newReason;
          if (!reason) throw new WorkRequestError(`Enter the ${to === 'REJECT' ? 'defect' : 'rework'} reason.`);
          const uninspected = round(Math.max(0, receivedBasis(item) - item.processedQuantity));
          const fresh = round(Math.min(quantity, uninspected));
          let fromPass = round(quantity - fresh);
          const passedNotSent = round(item.passedQuantity - item.transferredQuantity);
          if (fromPass > passedNotSent) throw new WorkRequestError(`Only ${round(fresh + passedNotSent)} ${item.uom} of the held quantity can be given a decision now.`);
          if (fresh > 0) {
            await tx.workItemInspection.create({
              data: {
                workItemId: item.id,
                inspectedQuantity: fresh,
                passQuantity: 0,
                rejectQuantity: to === 'REJECT' ? fresh : 0,
                reworkQuantity: to === 'REWORK' ? fresh : 0,
                uom: item.uom,
                rejectReason: to === 'REJECT' ? reason : null,
                reworkReason: to === 'REWORK' ? reason : null,
                remarks: [`Decision changed from HOLD: ${correctionReason}`, remarks].filter(Boolean).join(' · '),
                inspectorId: user.id,
              },
            });
            after.processedQuantity = round(item.processedQuantity + fresh);
          }
          if (fromPass > 0) {
            const batches = await tx.workItemInspection.findMany({ where: { workItemId: item.id, passQuantity: { gt: 0 } }, orderBy: { createdAt: 'desc' } });
            for (const b of batches) {
              if (fromPass <= 0) break;
              const take = round(Math.min(fromPass, b.passQuantity));
              await tx.workItemInspection.update({
                where: { id: b.id },
                data: { passQuantity: round(b.passQuantity - take), [field(to)]: round(b[field(to)] + take), [reasonField(to)]: reason },
              });
              fromPass = round(fromPass - take);
            }
            after.passedQuantity = round(item.passedQuantity - (quantity - fresh));
          }
          after[itemField(to)] = round(item[itemField(to)] + quantity);
        }

        // The Defective Shelf and the rework task follow the new totals (no challan either way).
        const reason = newReason || (to === 'REWORK' ? batch?.reworkReason ?? null : null);
        const routed = await routeQcDecisions(tx, cfg, item, after, user, reason);
        // Line totals and status; the line's row is locked by this transaction.
        await tx.departmentWorkItem.update({
          where: { id: item.id },
          data: {
            processedQuantity: after.processedQuantity,
            passedQuantity: after.passedQuantity,
            rejectedQuantity: after.rejectedQuantity,
            reworkQuantity: after.reworkQuantity,
            ...routed,
            status: qcStatusOf({ ...after, ...routed }),
            completedAt: availableToProcess(after) <= 0 ? item.completedAt ?? new Date() : null,
          },
        });

        // HOLD records follow (they update the line's heldQuantity themselves).
        const line = (await loadLines(cfg.code, [item.id]))[0];
        const note = `QC decision changed from ${LABEL[from]} to ${LABEL[to]}: ${correctionReason}`;
        if (to === 'HOLD') {
          if (!line) throw new WorkRequestError('This line cannot be placed on HOLD.');
          // The line was read as it was before this change: the quantity taken off its decision (still waiting, or
          // already routed to the shelf / rework task) is free to hold now.
          const fromWaiting = Math.min(round(line.writtenOff), quantity);
          await addToHold(
            tx,
            cfg.code,
            { ...line, writtenOff: round(line.writtenOff - fromWaiting), forwarded: round(Math.max(0, line.forwarded - (quantity - fromWaiting))) },
            holdCheck!,
            user,
            note,
          );
        }
        if (from === 'HOLD') {
          await takeFromHold(tx, cfg.code, `WORK_ITEM:${item.id}:${line?.unit || item.uom}`, quantity, user, note);
        }
        summary = `${quantity} ${item.uom} changed from ${LABEL[from]} to ${LABEL[to]}.`;
      }

      const saved = await tx.departmentWorkItem.findUniqueOrThrow({ where: { id: item.id } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: auditAction(cfg),
          entity: 'DepartmentWorkItem',
          entityId: item.id,
          beforeState: JSON.stringify({ ...before, batch: batchBefore }),
          afterState: JSON.stringify({
            from,
            to,
            quantity: from === to ? 0 : quantity,
            unit: item.uom,
            inspectionId: batch?.id || null,
            correctionReason,
            remarks,
            reason: newReason,
            holdReason: holdCheck?.reason || null,
            inspected: saved.processedQuantity,
            passed: saved.passedQuantity,
            rejected: saved.rejectedQuantity,
            rework: saved.reworkQuantity,
            held: saved.heldQuantity,
          }),
        },
      });
      return `${item.fabricName}: ${summary}`;
    }, TX);

    const data = await prisma.departmentWorkItem.findUnique({ where: { id: itemId }, include: WORK_ITEM_INCLUDE });
    return NextResponse.json({ data, message });
  }, 'Failed to change the QC decision.');
}

/** GET items/:id/decision — every decision change of the line, newest first, from the audit log. */
export function decisionHistory(request: Request, cfg: WorkflowConfig, itemId: string) {
  return guarded(request, cfg, async () => {
    const item = await prisma.departmentWorkItem.findFirst({ where: { id: itemId, departmentCode: cfg.code }, select: { id: true } });
    if (!item) throw new WorkRequestError('Work item not found.', 404);
    const rows = await prisma.auditLog.findMany({
      where: { entity: 'DepartmentWorkItem', entityId: itemId, action: auditAction(cfg) },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { fullName: true, username: true } } },
    });
    const data = rows.map((r: any) => {
      const after = JSON.parse(r.afterState || '{}');
      return {
        id: r.id,
        at: r.createdAt,
        by: r.actor?.fullName || r.actor?.username || null,
        from: after.from,
        to: after.to,
        quantity: after.quantity,
        unit: after.unit,
        correctionReason: after.correctionReason,
        remarks: after.remarks,
        reason: after.reason,
      };
    });
    return NextResponse.json({ data });
  }, 'Failed to load the decision changes.');
}

