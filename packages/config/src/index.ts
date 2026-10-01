import { DepartmentCode } from '@subham/types';

export const SYSTEM_CONFIG = {
  APP_NAME: 'Subham Fabrics MES',
  COMPANY_NAME: 'Subham Fabrics & Apparel Ltd.',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  PAGINATION_DEFAULT_LIMIT: 25,
  PAGINATION_MAX_LIMIT: 100,
  DEFAULT_FABRIC_TOLERANCE_PERCENT: 5.0,
  CHALLAN_NUMBER_PREFIX: 'CH',
  PROGRAM_NUMBER_PREFIX: 'PRG',
};

export const STANDARD_FACTORY_ROUTE: DepartmentCode[] = [
  DepartmentCode.STORE,
  DepartmentCode.DYEING,
  DepartmentCode.QC1,
  DepartmentCode.CUTTING,
  DepartmentCode.EMBROIDERY,
  DepartmentCode.THREAD_CUTTING,
  DepartmentCode.WASHING,
  DepartmentCode.QC2,
  DepartmentCode.RECUTTING,
  DepartmentCode.STITCHING,
  DepartmentCode.QC3,
  DepartmentCode.FINISHING,
  DepartmentCode.BUTTON_ATTACHMENT,
  DepartmentCode.STEAM_PRESS,
  DepartmentCode.PACKING,
  DepartmentCode.FINISHED_GOODS,
  DepartmentCode.DISPATCH,
];

export const DEPARTMENT_LABELS: Record<DepartmentCode, string> = {
  [DepartmentCode.PROGRAMMING]: 'Programming Department',
  [DepartmentCode.PRG]: 'Programming Department',
  [DepartmentCode.STORE]: 'Raw Material & Fabric Store',
  [DepartmentCode.DYEING]: 'Dyeing & Fabric Processing',
  [DepartmentCode.QC1]: 'Fabric Quality Gate (QC1)',
  [DepartmentCode.CUTTING]: 'Spreading & Cutting Section',
  [DepartmentCode.EMBROIDERY]: 'Embroidery Department',
  [DepartmentCode.THREAD_CUTTING]: 'Thread Cutting & Clean-up',
  [DepartmentCode.WASHING]: 'Garment Wash & Laundry',
  [DepartmentCode.QC2]: 'Post-Wash / Cut Panel Gate (QC2)',
  [DepartmentCode.RECUTTING]: 'Panel Re-Cutting Section',
  [DepartmentCode.STITCHING]: 'Stitching & Assembly Lines',
  [DepartmentCode.QC3]: 'Stitching Quality Gate (QC3)',
  [DepartmentCode.FINISHING]: 'Finishing & Thread Trimming',
  [DepartmentCode.BUTTON_ATTACHMENT]: 'Button & Trim Attachment',
  [DepartmentCode.STEAM_PRESS]: 'Boiler Steam Pressing',
  [DepartmentCode.PACKING]: 'Folding, Tagging & Polybagging',
  [DepartmentCode.FINISHED_GOODS]: 'Finished Goods Warehouse',
  [DepartmentCode.DISPATCH]: 'Outward Logistics & Dispatch',
};
