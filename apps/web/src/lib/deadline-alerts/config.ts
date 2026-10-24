import type { DepartmentKey } from '@/lib/auth/department-access';

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

export type AlertSource = DyeingOrdersSource | InboundChallansSource;

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
      openStatuses: ['RECEIVED', 'IN_DYEING', 'PARTIALLY_DYED', 'DYED', 'READY_FOR_QC1'],
    },
    workHref: ({ entityId }) => `/dyeing/my-work?tab=incoming&programId=${encodeURIComponent(entityId)}`,
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
    enabled: false,
    label: 'Embroidery',
    recipients: ['EMBROIDERY'],
    source: {
      kind: 'inboundChallans',
      toDepartments: ['EMBROIDERY'],
      openStatuses: ['ISSUED', 'RECEIVED', 'IN_PROGRESS'],
    },
    workHref: () => '/embroidery/my-work',
  },
  THREAD_CUTTING: {
    enabled: false,
    label: 'Thread Cutting',
    recipients: ['THREAD_CUTTING'],
    source: {
      kind: 'inboundChallans',
      toDepartments: ['THREAD_CUTTING'],
      openStatuses: ['ISSUED', 'RECEIVED', 'IN_PROGRESS'],
    },
    workHref: () => '/thread-cutting/my-work',
  },
};

export function alertConfigFor(department: string): DepartmentAlertConfig | null {
  const config = DEPARTMENT_ALERTS[department.toUpperCase() as DepartmentKey];
  return config ?? null;
}

export function enabledAlertDepartments(): DepartmentKey[] {
  return (Object.keys(DEPARTMENT_ALERTS) as DepartmentKey[]).filter((key) => DEPARTMENT_ALERTS[key]?.enabled);
}
