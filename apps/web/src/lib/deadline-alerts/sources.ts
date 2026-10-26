import { prisma } from '@subham/database';
import { DEADLINE_ALERTS, type AlertSource } from './config';

/** A unit of department work that can carry a deadline, normalized across sources. */
export interface WorkItem {
  entityType: 'DYEING_ORDER' | 'CHALLAN' | 'WORK_ITEM';
  entityId: string;
  programId: string | null;
  challanId: string | null;
  challanNumber: string | null;
  productionSheetId: string | null;
  designNumber: string | null;
  taskLabel: string;
  workStatus: string;
  /** Real delivery deadline, or null when the production sheet has none. */
  deadline: Date | null;
  /** Open = assigned / issued / received / in process and not completed, cancelled or closed. */
  isOpen: boolean;
  /** Why the task is closed, when it is. */
  closedReason: 'COMPLETED' | 'CANCELLED' | 'CLOSED' | null;
}

const programSelect = {
  id: true,
  programNumber: true,
  programSerialNo: true,
  designNumber: true,
  wilcomDesignNumber: true,
  styleCode: true,
  deliveryDate: true,
  status: true,
  metadataJson: true,
} as const;

type ProgramRow = {
  id: string;
  programNumber: string;
  programSerialNo: string | null;
  designNumber: string | null;
  wilcomDesignNumber: string | null;
  styleCode: string;
  deliveryDate: Date | null;
  status: string;
  metadataJson: string | null;
};

/**
 * The production sheet's delivery date, unless the server filled it in because none was
 * entered (see programs/production-sheet). Never invents a date.
 */
export function realDeadline(program: Pick<ProgramRow, 'deliveryDate' | 'metadataJson'> | null): Date | null {
  if (!program?.deliveryDate) return null;
  if (Number.isNaN(new Date(program.deliveryDate).getTime())) return null;
  if (program.metadataJson) {
    try {
      if (JSON.parse(program.metadataJson)?.deliveryDateDefaulted === true) return null;
    } catch {}
  }
  return new Date(program.deliveryDate);
}

function closedReasonFor(programStatus: string | undefined, challanStatus: string | undefined, isOpenStatus: boolean) {
  const programClosed = (DEADLINE_ALERTS.closedProgramStatuses as readonly string[]).includes(programStatus || '');
  const challanClosed = (DEADLINE_ALERTS.closedChallanStatuses as readonly string[]).includes(challanStatus || '');
  if (programStatus === 'CANCELLED' || challanStatus === 'CANCELLED') return 'CANCELLED' as const;
  if (programClosed || challanClosed) return programStatus === 'COMPLETED' ? ('COMPLETED' as const) : ('CLOSED' as const);
  if (!isOpenStatus) return 'COMPLETED' as const;
  return null;
}

function sheetFields(program: ProgramRow | null) {
  return {
    programId: program?.id ?? null,
    productionSheetId: program?.programSerialNo || program?.programNumber || null,
    designNumber: program?.designNumber || program?.wilcomDesignNumber || null,
    deadline: realDeadline(program),
  };
}

async function dyeingOrderItems(source: Extract<AlertSource, { kind: 'dyeingOrders' }>, ids?: string[]): Promise<WorkItem[]> {
  const orders = await prisma.dyeingOrder.findMany({
    where: ids ? { id: { in: ids } } : { status: { in: source.openStatuses } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      program: { select: programSelect },
      inboundChallan: { select: { id: true, challanNumber: true, status: true } },
    },
  });
  return orders.map((order) => {
    const closedReason = closedReasonFor(
      order.program?.status,
      order.inboundChallan?.status,
      source.openStatuses.includes(order.status),
    );
    return {
      entityType: 'DYEING_ORDER',
      entityId: order.id,
      ...sheetFields(order.program),
      challanId: order.inboundChallan?.id ?? null,
      challanNumber: order.inboundChallan?.challanNumber ?? null,
      taskLabel: `Dyeing ${order.orderNumber}`,
      workStatus: order.status,
      isOpen: closedReason === null,
      closedReason,
    };
  });
}

async function departmentWorkItems(source: Extract<AlertSource, { kind: 'workItems' }>, ids?: string[]): Promise<WorkItem[]> {
  const items = await prisma.departmentWorkItem.findMany({
    where: ids ? { id: { in: ids } } : { departmentCode: source.departmentCode, status: { in: source.openStatuses } },
    select: {
      id: true,
      itemNumber: true,
      status: true,
      fabricName: true,
      program: { select: programSelect },
      inboundChallan: { select: { id: true, challanNumber: true, status: true } },
    },
  });
  return items.map((item) => {
    const closedReason = closedReasonFor(item.program?.status, undefined, source.openStatuses.includes(item.status));
    return {
      entityType: 'WORK_ITEM',
      entityId: item.id,
      ...sheetFields(item.program),
      challanId: item.inboundChallan?.id ?? null,
      challanNumber: item.inboundChallan?.challanNumber ?? null,
      taskLabel: `${item.itemNumber} ${item.fabricName}`,
      workStatus: item.status,
      isOpen: closedReason === null,
      closedReason,
    };
  });
}

async function inboundChallanItems(source: Extract<AlertSource, { kind: 'inboundChallans' }>, ids?: string[]): Promise<WorkItem[]> {
  const challans = await prisma.challan.findMany({
    where: ids ? { id: { in: ids } } : { toDepartment: { in: source.toDepartments }, status: { in: source.openStatuses } },
    select: {
      id: true,
      challanNumber: true,
      challanType: true,
      status: true,
      program: { select: programSelect },
    },
  });
  return challans.map((challan) => {
    const closedReason = closedReasonFor(challan.program?.status, challan.status, source.openStatuses.includes(challan.status));
    return {
      entityType: 'CHALLAN',
      entityId: challan.id,
      ...sheetFields(challan.program),
      challanId: challan.id,
      challanNumber: challan.challanNumber,
      taskLabel: challan.challanType.replace(/_/g, ' '),
      workStatus: challan.status,
      isOpen: closedReason === null,
      closedReason,
    };
  });
}

/** Open work items for a source, or (with `ids`) the current state of specific items, open or not. */
export function loadWorkItems(source: AlertSource, ids?: string[]): Promise<WorkItem[]> {
  switch (source.kind) {
    case 'dyeingOrders':
      return dyeingOrderItems(source, ids);
    case 'inboundChallans':
      return inboundChallanItems(source, ids);
    case 'workItems':
      return departmentWorkItems(source, ids);
  }
}
