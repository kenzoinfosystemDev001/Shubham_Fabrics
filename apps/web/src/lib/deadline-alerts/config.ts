import type { DepartmentKey } from '@/lib/auth/department-access';
import { OPEN_DYEING_STATUSES } from '@/lib/dyeing-workflow.mjs';
import { OPEN_WORK_STATUSES } from '@/lib/work-items.mjs';

/**
 * Smart Deadline Alerts configuration. Everything department-specific lives here: turning a
 * department on is a matter of setting `enabled: true` on its entry.
 *
 * Sources:
 *   dyeingOrders    - DyeingOrder rows (the Dyeing work queue)
 *   inboundChallans - challans addressed to the department, for departments whose work queue
 *                     is the challans they receive (QC1, Embroidery, Thread Cutting ...)
 *
 * The deadline is always the production sheet's delivery date (Program.deliveryDate). A sheet
 * whose delivery date was filled in by the server rather than entered by a user
 * (metadataJson.deliveryDateDefaulted) is treated as having no deadline.
 */

export interface DyeingOrdersSource {
  kind: 'dyeingOrders';
  /** Order statuses that count as open work. Anything else (e.g. SENT_TO_QC1) is finished for this department. */
  openStatuses: string[];
}

export interface InboundChallansSource {
  kind: 'inboundChallans';
  /** Stored challan `toDepartment` codes for this department. */
  toDepartments: string[];
  /** Challan statuses that count as open work (assigned, issued, received, in process). */
  openStatuses: string[];
}

export interface WorkItemsSource {
  kind: 'workItems';
  /** DepartmentWorkItem.departmentCode (one item per incoming challan line). */
  departmentCode: string;
  /** Item statuses that count as open work; anything else (e.g. TRANSFERRED) is finished. */
  openStatuses: string[];
}

export type AlertSource = DyeingOrdersSource | InboundChallansSource | WorkItemsSource;

export interface DepartmentAlertConfig {
  enabled: boolean;
  /** Department label shown in the UI. */
  label: string;
  /** Who may see the alerts: members of these departments (administrators always can). */
  recipients: DepartmentKey[];
  source: AlertSource;
  /** Where "View Work" goes; the page and its APIs apply their own department checks. */
  workHref: (item: { entityId: string; challanId: string | null; programId: string | null }) => string;
}

export const DEADLINE_ALERTS = {
  /** Factory time zone used for every "today" / "days left" calculation. */
  timeZone: process.env.FACTORY_TIME_ZONE || 'Asia/Kolkata',
  /** Upcoming-deadline thresholds in days. Due today and overdue are always on. */
  thresholds: [7, 3, 1],
  /** Thresholds at or below this many days are WARNING; wider ones are INFO. */
  warningWithinDays: 3,
  /** Program statuses that close every task of the production sheet. */
  closedProgramStatuses: ['COMPLETED', 'CANCELLED', 'CLOSED'],
  /** Challan statuses that close the task fed by that challan. */
  closedChallanStatuses: ['CANCELLED', 'CLOSED', 'REJECTED'],
} as const;

export const DEPARTMENT_ALERTS: Partial<Record<DepartmentKey, DepartmentAlertConfig>> = {
  DYEING: {
    enabled: true,
    label: 'Dyeing',
    recipients: ['DYEING'],
    source: {
      kind: 'dyeingOrders',
      openStatuses: [...OPEN_DYEING_STATUSES],
    },
    workHref: ({ entityId }) => `/dyeing/my-work/process?orderId=${encodeURIComponent(entityId)}`,
  },
  QC1: {
    enabled: false,
    label: 'QC 1',
    recipients: ['QC1'],
    source: {
      kind: 'inboundChallans',
      toDepartments: ['QC1'],
      openStatuses: ['ISSUED', 'RECEIVED', 'UNDER_INSPECTION', 'REWORK_REQUESTED', 'ON_HOLD'],
    },
    workHref: () => '/qc1/my-work',
  },
  EMBROIDERY: {
    enabled: true,
    label: 'Embroidery',
    recipients: ['EMBROIDERY'],
    source: { kind: 'workItems', departmentCode: 'EMBROIDERY', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/embroidery/my-work/process?itemId=${encodeURIComponent(entityId)}`,
  },
  THREAD_CUTTING: {
    enabled: true,
    label: 'Thread Cutting',
    recipients: ['THREAD_CUTTING'],
    source: { kind: 'workItems', departmentCode: 'THREAD_CUTTING', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/thread-cutting/my-work/process?itemId=${encodeURIComponent(entityId)}`,
  },
  QC2: {
    enabled: true,
    label: 'Threadcut QC',
    recipients: ['QC2'],
    source: { kind: 'workItems', departmentCode: 'QC2', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/qc2/my-work/inspection?itemId=${encodeURIComponent(entityId)}`,
  },
  WASHING: {
    enabled: true,
    label: 'Washing',
    recipients: ['WASHING'],
    source: { kind: 'workItems', departmentCode: 'WASHING', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/washing/my-work/process?itemId=${encodeURIComponent(entityId)}`,
  },
  QC3: {
    enabled: true,
    label: 'Washing QC',
    recipients: ['QC3'],
    source: { kind: 'workItems', departmentCode: 'QC3', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/qcwashing/my-work/inspection?itemId=${encodeURIComponent(entityId)}`,
  },
  RECUTTING: {
    enabled: true,
    label: 'Recutting',
    recipients: ['RECUTTING'],
    source: { kind: 'workItems', departmentCode: 'RECUTTING', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/recutting/my-work/allocation?itemId=${encodeURIComponent(entityId)}`,
  },
  STITCHING: {
    enabled: true,
    label: 'Stitching',
    recipients: ['STITCHING'],
    source: { kind: 'workItems', departmentCode: 'STITCHING', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/stitching/my-work/process?itemId=${encodeURIComponent(entityId)}`,
  },
  FINISHING: {
    enabled: true,
    label: 'Finishing',
    recipients: ['FINISHING'],
    source: { kind: 'workItems', departmentCode: 'FINISHING', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/finishing/my-work/process?itemId=${encodeURIComponent(entityId)}`,
  },
  STEAM_PRESS: {
    enabled: true,
    label: 'Steam Press',
    recipients: ['STEAM_PRESS'],
    source: { kind: 'workItems', departmentCode: 'STEAM_PRESS', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/steam-press/my-work/process?itemId=${encodeURIComponent(entityId)}`,
  },
  FINAL_CHECK: {
    enabled: true,
    label: 'Final QC',
    recipients: ['FINAL_CHECK'],
    source: { kind: 'workItems', departmentCode: 'FINAL_CHECK', openStatuses: [...OPEN_WORK_STATUSES] },
    workHref: ({ entityId }) => `/final-check/my-work/inspection?itemId=${encodeURIComponent(entityId)}`,
  },
  // Finished garments: open until every piece received has been packed (COMPLETED = fully packed).
  INVENTORY: {
    enabled: true,
    label: 'Inventory',
    recipients: ['INVENTORY'],
    source: { kind: 'workItems', departmentCode: 'INVENTORY', openStatuses: ['AWAITING_RECEIPT', 'RECEIVED', 'IN_PROGRESS'] },
    workHref: ({ entityId }) => `/inventory/packing?itemId=${encodeURIComponent(entityId)}`,
  },
};

export function alertConfigFor(department: string): DepartmentAlertConfig | null {
  const config = DEPARTMENT_ALERTS[department.toUpperCase() as DepartmentKey];
  return config ?? null;
}

export function enabledAlertDepartments(): DepartmentKey[] {
  return (Object.keys(DEPARTMENT_ALERTS) as DepartmentKey[]).filter((key) => DEPARTMENT_ALERTS[key]?.enabled);
}
