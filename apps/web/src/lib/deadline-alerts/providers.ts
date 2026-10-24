import { prisma } from '@subham/database';
import type { DeadlineTask } from './plan';

/**
 * A task provider lists a department's open work with its real deadline. To enable alerts
 * for another department (Dyeing QC, Embroidery, Thread Cutting, ...), add a provider here
 * that reads that department's own task records and deadline, then enable the department
 * in config.ts.
 */
export type DeadlineTaskProvider = () => Promise<DeadlineTask[]>;

// Dyeing work is finished for alert purposes once it has been sent to Dyeing QC.
const DYEING_CLOSED_ORDER_STATUSES = ['SENT_TO_DYEING_QC', 'COMPLETED', 'CANCELLED', 'CLOSED'];
const CLOSED_CHALLAN_STATUSES = ['CANCELLED', 'CLOSED', 'COMPLETED', 'HANDED_OVER', 'REJECTED'];

/**
 * Dyeing: one task per Dyeing order (each required colour line of an incoming Fabric Store
 * challan). The deadline is the delivery date entered on that incoming challan. Orders whose
 * challan has no delivery date are returned with `deadline: null` and never get a made-up one.
 */
export const dyeingTaskProvider: DeadlineTaskProvider = async () => {
  const orders = await prisma.dyeingOrder.findMany({
    where: {
      status: { notIn: DYEING_CLOSED_ORDER_STATUSES },
      OR: [{ inboundChallanId: null }, { inboundChallan: { status: { notIn: CLOSED_CHALLAN_STATUSES } } }],
    },
    select: {
      id: true,
      status: true,
      fabricName: true,
      targetColor: true,
      inchargeId: true,
      programId: true,
      program: { select: { programSerialNo: true, programNumber: true, designNumber: true } },
      inboundChallan: { select: { id: true, challanNumber: true, deliveryDate: true } },
    },
  });

  return orders.map((order) => ({
    department: 'DYEING',
    taskType: 'DYEING_ORDER',
    taskId: order.id,
    challanId: order.inboundChallan?.id || null,
    challanNumber: order.inboundChallan?.challanNumber || null,
    programId: order.programId,
    productionSheetNumber: order.program?.programSerialNo || order.program?.programNumber || null,
    designNumber: order.program?.designNumber || null,
    process: `Dyeing: ${order.fabricName} to ${order.targetColor}`,
    status: order.status,
    assignedUserId: order.inchargeId,
    deadline: order.inboundChallan?.deliveryDate || null,
    deadlineSource: 'CHALLAN_DELIVERY_DATE',
    viewUrl: `/dyeing/my-work?order=${encodeURIComponent(order.id)}`,
  }));
};

export const DEADLINE_TASK_PROVIDERS: Record<string, DeadlineTaskProvider> = {
  DYEING: dyeingTaskProvider,
};
