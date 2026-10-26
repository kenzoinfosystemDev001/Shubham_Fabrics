// Screen settings for departments built on DepartmentWorkItem (see lib/work-items-server.ts).
// A new department reuses components/workflow/* by adding an entry here plus its API routes.

import { FINAL_QC_CHECKPOINTS } from '@/lib/work-items.mjs';

export interface WorkflowView {
  /** Department code, as stored on work items and challans. */
  code: 'EMBROIDERY' | 'THREAD_CUTTING' | 'QC2' | 'WASHING' | 'QC3' | 'RECUTTING' | 'STITCHING' | 'FINISHING' | 'STEAM_PRESS' | 'FINAL_CHECK';
  /** Name of the work, e.g. "Embroidery". */
  label: string;
  /** API base, e.g. "/api/embroidery". */
  api: string;
  /** Page base, e.g. "/embroidery". */
  base: string;
  /** Receiving department name, e.g. "Thread Cutting". */
  next: string;
  /** Dashboard shows "Fabric Received" (all held) and "Pending <label>" (not started) as separate cards. */
  pendingCard?: boolean;
  /** Screens say "material" instead of "fabric". */
  material?: boolean;
  /** Recutting: lines are allocated to garment categories (components/recutting). */
  allocation?: boolean;
  /** The department stock report has no entry for this department. */
  noStockTab?: boolean;
  /** Production (Stitching): taken into production, good completed and defective are recorded apart. */
  production?: boolean;
  /** Screens say "garments" (stitched work, Finishing onward). */
  garments?: boolean;
  /**
   * Finished garments: outgoing challans list garments by name and image only (no colour, fabric,
   * measurement or quantity); each chosen garment sends all its pieces. Finishing adds the images.
   */
  finishedGoods?: boolean;
  /** Production dashboard: which cards, in order (see WorkDashboard), and label overrides. */
  cards?: ProductionCard[];
  cardLabels?: Partial<Record<ProductionCard, string>>;
  /** Transfers read as "Dispatched" ("Partially Dispatched", "Dispatched to <next>"). */
  dispatchWords?: boolean;
  /** Title of the work page, when not "<label> Process" / "<label> Production". */
  processTitle?: string;
  /** Has its own Outgoing Challans page (my-work/outgoing). */
  outgoingPage?: boolean;
  /** Has its own Department Defective Shelf page (my-work/defective). */
  defectivePage?: boolean;
  /** QC departments inspect: PASS goes to `next`, REJECT and REWORK to these destinations. */
  qc?: { rejectTo: string; reworkTo: string };
  /** Receipt cannot exceed the dispatched quantity; incoming lines show dispatched / received / pending. */
  strictReceipt?: boolean;
  /** QC dashboard reports passed, rejected, rework and dispatched quantities (Final QC). */
  qcTotals?: boolean;
  /** Has its own Passed Items page (my-work/passed). */
  passedPage?: boolean;
  /** QC history adds garment category, defect reason, rework status and dispatch status filters. */
  historyFilters?: boolean;
  /** Checkpoints recorded as Pass / Fail on every inspection batch. */
  checkpoints?: ReadonlyArray<{ key: string; label: string }>;
  /** Title of the inspection page, when not "QC Inspection". */
  inspectionTitle?: string;
  /** Only this unit may be sent to `next` (Final QC -> Inventory: PCS); other lines are listed as blocked. */
  passUnit?: string;
}

export type ProductionCard = 'pendingInward' | 'received' | 'pending' | 'inProgress' | 'partial' | 'completed' | 'ready' | 'issued' | 'alerts' | 'overdue';

/** Status name for a work item in this department (`fallback` is the shared name). */
export function statusName(flow: WorkflowView, status: string, fallback: string) {
  if (flow.dispatchWords && status === 'PARTIALLY_TRANSFERRED') return 'Partially Dispatched';
  if (flow.dispatchWords && status === 'TRANSFERRED') return `Dispatched to ${flow.next}`;
  return fallback;
}

/** The page where a line's work is recorded (QC departments inspect). */
export function workPath(flow: WorkflowView) {
  return `${flow.base}/my-work/${flow.qc ? 'inspection' : flow.allocation ? 'allocation' : 'process'}`;
}

export type TransferKind = 'PASS' | 'REJECT' | 'REWORK';

/** Page that issues challans of this kind. */
export function transferPath(flow: WorkflowView, kind: TransferKind) {
  return `${flow.base}/my-work/${kind === 'REJECT' ? 'rejected' : kind === 'REWORK' ? 'rework' : 'issue-challan'}`;
}

/** Destination name for a transfer of this kind. */
export function destinationName(flow: WorkflowView, kind: TransferKind) {
  if (kind === 'REJECT') return flow.qc?.rejectTo || flow.next;
  if (kind === 'REWORK') return flow.qc?.reworkTo || flow.next;
  return flow.next;
}

export const EMBROIDERY_FLOW: WorkflowView = {
  code: 'EMBROIDERY',
  label: 'Embroidery',
  api: '/api/embroidery',
  base: '/embroidery',
  next: 'Thread Cutting',
};

export const THREAD_CUTTING_FLOW: WorkflowView = {
  code: 'THREAD_CUTTING',
  label: 'Thread Cutting',
  api: '/api/thread-cutting',
  base: '/thread-cutting',
  next: 'Threadcut QC',
  pendingCard: true,
};

export const WASHING_FLOW: WorkflowView = {
  code: 'WASHING',
  label: 'Washing',
  api: '/api/washing',
  base: '/washing',
  next: 'Washing QC',
  pendingCard: true,
  material: true,
};

// Threadcut QC keeps the historical code and URL "qc2" so permissions and history stay intact.
export const THREADCUT_QC_FLOW: WorkflowView = {
  code: 'QC2',
  label: 'Threadcut QC',
  api: '/api/qc2',
  base: '/qc2',
  next: 'Washing',
  qc: { rejectTo: 'Fabric Store Defective Shelf', reworkTo: 'Thread Cutting' },
};

export const RECUTTING_FLOW: WorkflowView = {
  code: 'RECUTTING',
  label: 'Recutting',
  api: '/api/recutting',
  base: '/recutting',
  next: 'Stitching',
  allocation: true,
  noStockTab: true,
};

export const STITCHING_FLOW: WorkflowView = {
  code: 'STITCHING',
  label: 'Stitching',
  api: '/api/stitching',
  base: '/stitching',
  next: 'Finishing',
  pendingCard: true,
  material: true,
  production: true,
  noStockTab: true,
};

export const FINISHING_FLOW: WorkflowView = {
  code: 'FINISHING',
  label: 'Finishing',
  api: '/api/finishing',
  base: '/finishing',
  next: 'Steam Press',
  pendingCard: true,
  production: true,
  garments: true,
  finishedGoods: true,
  noStockTab: true,
  processTitle: 'Finishing Process',
  cards: ['pendingInward', 'received', 'pending', 'inProgress', 'partial', 'ready', 'issued', 'alerts', 'overdue'],
};

export const STEAM_PRESS_FLOW: WorkflowView = {
  code: 'STEAM_PRESS',
  label: 'Steam Press',
  api: '/api/steam-press',
  base: '/steam-press',
  next: 'Final QC',
  pendingCard: true,
  production: true,
  garments: true,
  finishedGoods: true,
  noStockTab: true,
  dispatchWords: true,
  processTitle: 'Steam Press Processing',
  outgoingPage: true,
  defectivePage: true,
  cards: ['pendingInward', 'received', 'pending', 'inProgress', 'partial', 'completed', 'ready', 'issued', 'overdue'],
  cardLabels: { pendingInward: 'Pending Receipts', inProgress: 'In Progress', partial: 'Partially Completed', completed: 'Completed', issued: 'Dispatched to Final QC' },
};

// Final QC keeps the historical code FINAL_CHECK and URL "final-check".
export const FINAL_QC_FLOW: WorkflowView = {
  code: 'FINAL_CHECK',
  label: 'Final QC',
  api: '/api/final-check',
  base: '/final-check',
  next: 'Inventory',
  passUnit: 'PCS',
  garments: true,
  finishedGoods: true,
  noStockTab: true,
  outgoingPage: true,
  defectivePage: true,
  strictReceipt: true,
  qcTotals: true,
  passedPage: true,
  historyFilters: true,
  checkpoints: FINAL_QC_CHECKPOINTS,
  inspectionTitle: 'Final Inspection',
  qc: { rejectTo: 'Fabric Store Defective Shelf', reworkTo: 'Steam Press' },
};

// Washing QC keeps the historical code QC3 and URL "qcwashing".
export const WASHING_QC_FLOW: WorkflowView = {
  code: 'QC3',
  label: 'Washing QC',
  api: '/api/qcwashing',
  base: '/qcwashing',
  next: 'Recutting',
  qc: { rejectTo: 'Fabric Store Defective Shelf', reworkTo: 'Washing' },
};

const DEPARTMENT_NAMES: Record<string, string> = {
  STORE: 'Fabric Store',
  PROGRAMMING: 'Programming',
  DYEING: 'Dyeing',
  QC1: 'Dyeing QC',
  EMBROIDERY: 'Embroidery',
  THREAD_CUTTING: 'Thread Cutting',
  QC2: 'Threadcut QC',
  WASHING: 'Washing',
  QC3: 'Washing QC',
  RECUTTING: 'Recutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  STEAM_PRESS: 'Steam Press',
  FINAL_CHECK: 'Final QC',
  INVENTORY: 'Inventory',
  // The earlier "Packing & Inventory" department, now Inventory.
  PACKING: 'Inventory',
};

export function departmentName(code?: string | null) {
  if (!code) return '—';
  return DEPARTMENT_NAMES[code.toUpperCase()] || code.replace(/_/g, ' ');
}
