import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';
import { departmentKeyFor, userBelongsToDepartment } from '@/lib/auth/department-access';
import { WORKFLOWS, errorResponse, round, WorkRequestError, type WorkflowConfig } from '@/lib/work-items-server';
import { REWORK_ORIGIN } from '@/lib/rework-routing-server';
import { REWORK_STAGE_LABEL, dyeingTaskStage, reworkRemaining, workTaskStage } from '@/lib/rework.mjs';
import { receivedBasis } from '@/lib/work-items.mjs';
import { departmentName } from '@/lib/workflow-views';

export const dynamic = 'force-dynamic';

const PROGRAM = { select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, designName: true } } as const;
const CHALLAN = { select: { id: true, challanNumber: true, status: true, toDepartment: true, receivedDate: true } } as const;
const userName = (u: { fullName?: string | null; username?: string | null } | null | undefined) => u?.fullName || u?.username || null;
const sheetFields = (p: { id: string; programNumber: string; programSerialNo: string | null; designNumber: string | null; designName: string } | null) => ({
  programId: p?.id || null,
  productionSheet: p?.programNumber || null,
  serialNumber: p?.programSerialNo || null,
  designNumber: p?.designNumber || p?.designName || null,
});

/** Departments that receive QC REWORK without a challan: every configured rework destination, and Dyeing (Dyeing QC). */
function reworkDepartments() {
  const codes = new Set((Object.values(WORKFLOWS) as WorkflowConfig[]).flatMap((c) => (c.qc ? [c.qc.reworkTo.code] : [])));
  codes.add('DYEING');
  return codes;
}

// GET /api/rework-tasks?department=CODE&open=1 — the department's rework tasks: QC REWORK decisions routed here
// without a challan, with their original Production Sheet, challan and fabric, stage (Rework Pending ... Received by
// Next Department) and the challans they were forwarded on. open=1 leaves out tasks fully forwarded and received.
export async function GET(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const p = new URL(request.url).searchParams;
    const department = departmentKeyFor(p.get('department')) || '';
    if (!reworkDepartments().has(department)) throw new WorkRequestError('This department does not receive rework.');
    if (!userBelongsToDepartment(user, department)) throw new WorkRequestError('You do not have access to this department.', 403);
    const openOnly = p.get('open') === '1';

    let data: any[];
    if (department === 'DYEING') {
      const orders = await prisma.dyeingOrder.findMany({
        where: { origin: REWORK_ORIGIN },
        include: { program: PROGRAM, inboundChallan: { select: { id: true, challanNumber: true, items: { select: { id: true, shade: true, garmentCategory: true } } } }, receivedBy: { select: { fullName: true, username: true } }, qcTransfers: { orderBy: { createdAt: 'asc' }, include: { challan: CHALLAN } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      data = orders.map((o) => {
        const stage = dyeingTaskStage(o, o.qcTransfers.map((q) => q.challan.status));
        const line = o.inboundChallan?.items.find((i) => i.id === o.reworkChallanItemId);
        return {
          id: o.id,
          number: o.orderNumber,
          department: 'DYEING',
          sourceDepartment: 'QC1',
          sourceLabel: `Dyeing QC challan ${o.inboundChallan?.challanNumber || '—'}`,
          originalChallanId: o.inboundChallanId,
          originalChallanNumber: o.inboundChallan?.challanNumber || null,
          originalChallanItemId: o.reworkChallanItemId,
          ...sheetFields(o.program),
          productionType: line?.garmentCategory || null,
          fabricName: o.fabricName,
          colour: o.targetColor || null,
          shade: o.colorCode || line?.shade || null,
          unit: o.uom,
          reworkQuantity: round(o.receivedQuantity ?? o.requiredQuantity),
          completedQuantity: round(o.dyedQuantity),
          forwardedQuantity: round(o.sentToQc1Quantity),
          remainingQuantity: reworkRemaining(o),
          heldQuantity: round(o.heldQuantity),
          stage,
          stageLabel: (REWORK_STAGE_LABEL as Record<string, string>)[stage],
          reason: o.reworkReason,
          decidedBy: userName(o.receivedBy),
          decidedAt: o.createdAt,
          nextDepartment: 'Dyeing QC',
          forwardings: o.qcTransfers.map((q) => ({ challanId: q.challan.id, challanNumber: q.challan.challanNumber, status: q.challan.status, toDepartment: departmentName(q.challan.toDepartment), quantity: round(q.quantity), unit: q.uom, at: q.createdAt, receivedDate: q.challan.receivedDate })),
        };
      });
    } else {
      const cfg = (WORKFLOWS as Record<string, WorkflowConfig>)[department];
      const tasks = await prisma.departmentWorkItem.findMany({
        where: { departmentCode: department, origin: REWORK_ORIGIN },
        include: {
          program: PROGRAM,
          inboundChallan: { select: { id: true, challanNumber: true, items: { select: { id: true, shade: true } } } },
          receivedBy: { select: { fullName: true, username: true } },
          transfers: { orderBy: { createdAt: 'asc' }, include: { challan: CHALLAN } },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const sources = tasks.length
        ? await prisma.departmentWorkItem.findMany({ where: { id: { in: tasks.map((t) => t.reworkSourceItemId!).filter(Boolean) } }, select: { id: true, itemNumber: true } })
        : [];
      const sourceOf = new Map(sources.map((s) => [s.id, s.itemNumber]));
      data = tasks.map((t) => {
        const stage = workTaskStage(t, t.transfers.map((x) => x.challan.status));
        const line = t.inboundChallan?.items.find((i) => i.id === t.inboundChallanItemId);
        return {
          id: t.id,
          number: t.itemNumber,
          department,
          sourceDepartment: departmentKeyFor(t.sourceDepartment) || t.sourceDepartment,
          sourceLabel: `${departmentName(t.sourceDepartment)} line ${sourceOf.get(t.reworkSourceItemId || '') || '—'}`,
          originalChallanId: t.inboundChallanId,
          originalChallanNumber: t.inboundChallan?.challanNumber || null,
          originalChallanItemId: t.inboundChallanItemId,
          ...sheetFields(t.program),
          productionType: t.garmentCategory,
          styleRef: t.styleRef,
          fabricName: t.fabricName,
          colour: t.colour,
          shade: line?.shade || null,
          unit: t.uom,
          reworkQuantity: receivedBasis(t),
          completedQuantity: round(t.processedQuantity),
          defectQuantity: round(t.defectQuantity),
          forwardedQuantity: round(t.transferredQuantity),
          remainingQuantity: reworkRemaining(t),
          heldQuantity: round(t.heldQuantity),
          stage,
          stageLabel: (REWORK_STAGE_LABEL as Record<string, string>)[stage],
          reason: t.reworkReason,
          decidedBy: userName(t.receivedBy),
          decidedAt: t.createdAt,
          nextDepartment: cfg?.next?.label || null,
          forwardings: t.transfers.map((x) => ({ challanId: x.challan.id, challanNumber: x.challan.challanNumber, status: x.challan.status, toDepartment: departmentName(x.challan.toDepartment), quantity: round(x.quantity), unit: x.uom, at: x.createdAt, receivedDate: x.challan.receivedDate })),
        };
      });
    }
    // A task whose REWORK was taken back entirely (kept only for its HOLD history) has nothing to show.
    data = data.filter((r) => r.reworkQuantity > 0 || r.forwardedQuantity > 0);
    if (openOnly) data = data.filter((r) => r.stage !== 'RECEIVED_NEXT');
    return NextResponse.json({ department, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load the rework tasks.');
  }
}
