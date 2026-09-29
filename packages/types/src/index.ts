// Subham Fabrics MES - Domain Models and Types

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PRODUCTION_MANAGER = 'PRODUCTION_MANAGER',
  STORE_SUPERVISOR = 'STORE_SUPERVISOR',
  DYEING_SUPERVISOR = 'DYEING_SUPERVISOR',
  CUTTING_SUPERVISOR = 'CUTTING_SUPERVISOR',
  EMBROIDERY_SUPERVISOR = 'EMBROIDERY_SUPERVISOR',
  WASHING_SUPERVISOR = 'WASHING_SUPERVISOR',
  STITCHING_SUPERVISOR = 'STITCHING_SUPERVISOR',
  FINISHING_SUPERVISOR = 'FINISHING_SUPERVISOR',
  PACKING_SUPERVISOR = 'PACKING_SUPERVISOR',
  DISPATCH_MANAGER = 'DISPATCH_MANAGER',
  QC_INSPECTOR = 'QC_INSPECTOR',
  OPERATOR = 'OPERATOR',
}

export enum DepartmentCode {
  STORE = 'STORE',
  DYEING = 'DYEING',
  QC1 = 'QC1',
  CUTTING = 'CUTTING',
  EMBROIDERY = 'EMBROIDERY',
  THREAD_CUTTING = 'THREAD_CUTTING',
  WASHING = 'WASHING',
  QC2 = 'QC2',
  RECUTTING = 'RECUTTING',
  STITCHING = 'STITCHING',
  QC3 = 'QC3',
  FINISHING = 'FINISHING',
  BUTTON_ATTACHMENT = 'BUTTON_ATTACHMENT',
  STEAM_PRESS = 'STEAM_PRESS',
  PACKING = 'PACKING',
  FINISHED_GOODS = 'FINISHED_GOODS',
  DISPATCH = 'DISPATCH',
}

export enum ProgramStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD',
}

export enum PriorityLevel {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ChallanStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ISSUED = 'ISSUED',
  RECEIVED = 'RECEIVED',
  IN_PROCESS = 'IN_PROCESS',
  COMPLETED = 'COMPLETED',
  QC_PENDING = 'QC_PENDING',
  QC_APPROVED = 'QC_APPROVED',
  HANDED_OVER = 'HANDED_OVER',
  CLOSED = 'CLOSED',
  ON_HOLD = 'ON_HOLD',
  REWORK = 'REWORK',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ChallanType {
  FABRIC_ISSUE = 'FABRIC_ISSUE',
  INTER_DEPARTMENT = 'INTER_DEPARTMENT',
  REWORK_HANDOFF = 'REWORK_HANDOFF',
  RETURN_TO_STORE = 'RETURN_TO_STORE',
  FG_TRANSFER = 'FG_TRANSFER',
  DISPATCH = 'DISPATCH',
}

export enum ProductionUnitType {
  ROLL = 'ROLL',
  LOT = 'LOT',
  BUNDLE = 'BUNDLE',
  PIECE = 'PIECE',
  CARTON = 'CARTON',
}

export enum QualityStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CONDITIONALLY_PASSED = 'CONDITIONALLY_PASSED',
}

export enum AuditEventType {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PROGRAM_CREATED = 'PROGRAM_CREATED',
  PROGRAM_UPDATED = 'PROGRAM_UPDATED',
  PROGRAM_APPROVED = 'PROGRAM_APPROVED',
  PROGRAM_STATUS_CHANGED = 'PROGRAM_STATUS_CHANGED',
  CHALLAN_CREATED = 'CHALLAN_CREATED',
  CHALLAN_SUBMITTED = 'CHALLAN_SUBMITTED',
  CHALLAN_ISSUED = 'CHALLAN_ISSUED',
  CHALLAN_RECEIVED = 'CHALLAN_RECEIVED',
  PRODUCTION_STARTED = 'PRODUCTION_STARTED',
  PRODUCTION_RECORDED = 'PRODUCTION_RECORDED',
  PRODUCTION_COMPLETED = 'PRODUCTION_COMPLETED',
  QC_STARTED = 'QC_STARTED',
  QC_PASSED = 'QC_PASSED',
  QC_FAILED = 'QC_FAILED',
  REWORK_CREATED = 'REWORK_CREATED',
  REWORK_COMPLETED = 'REWORK_COMPLETED',
  MATERIAL_CONSUMED = 'MATERIAL_CONSUMED',
  MATERIAL_RETURNED = 'MATERIAL_RETURNED',
  STOCK_ADJUSTED = 'STOCK_ADJUSTED',
  PACKING_COMPLETED = 'PACKING_COMPLETED',
  FG_RECEIVED = 'FG_RECEIVED',
  DISPATCH_CREATED = 'DISPATCH_CREATED',
  EXCEPTION_TRIGGERED = 'EXCEPTION_TRIGGERED',
}

// User & Auth
export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentCode?: DepartmentCode;
  isActive: boolean;
}

// Fabric Component in Program File
export interface ProgramFabricComponent {
  id?: string;
  fabricCode: string;
  fabricName: string;
  fabricType: string;
  composition: string;
  widthInInches: number;
  gsm: number;
  colour: string;
  shade: string;
  requiredQuantity: number;
  tolerancePercentage: number;
  supplier: string;
}

// Garment Measurement Spec
export interface ProgramMeasurementSpec {
  id?: string;
  size: string;
  length: number;
  chest: number;
  waist: number;
  shoulder: number;
  sleeveLength: number;
  armhole: number;
  neck: number;
  bottom: number;
  otherSpecs?: Record<string, number>;
}

// Size & Color Distribution Matrix
export interface ProgramSizeMatrixItem {
  id?: string;
  size: string;
  targetQuantity: number;
}

export interface ProgramColorMatrixItem {
  id?: string;
  colorCode: string;
  colorName: string;
  pantoneReference?: string;
  shade: string;
  targetQuantity: number;
}

// Bill of Materials (BOM) Item
export interface ProgramBOMItem {
  id?: string;
  itemCode: string;
  itemName: string;
  category: 'MAIN_FABRIC' | 'LINING' | 'THREAD' | 'BUTTON' | 'ZIP' | 'LABEL' | 'TAG' | 'PACKING_BAG' | 'CARTON' | 'EMBROIDERY_THREAD' | 'INTERLINING' | 'OTHER_TRIM';
  requiredQuantityPerPiece: number;
  uom: string;
  wastagePercentage: number;
  totalRequiredQuantity: number;
  supplier?: string;
}

// Configurable Route Step per Program
export interface ProgramRouteStep {
  id?: string;
  sequenceOrder: number;
  departmentCode: DepartmentCode;
  standardCycleTimeMinutes?: number;
  isMandatory: boolean;
  requiresQCGate: boolean;
}

// Full Program File
export interface ProgramFile {
  id: string;
  programNumber: string; // e.g. PRG-2026-0001
  programDate: string;
  buyer: string;
  orderNumber: string;
  designNumber: string;
  designName: string;
  designVersion: string;
  patternNumber: string;
  styleCode: string;
  productCategory: string;
  description?: string;
  referenceImageUrl?: string;
  technicalDrawingUrl?: string;
  specificationSheetUrl?: string;
  targetQuantity: number;
  deliveryDate: string;
  priority: PriorityLevel;
  status: ProgramStatus;
  createdById: string;
  approvedById?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  fabrics: ProgramFabricComponent[];
  measurements: ProgramMeasurementSpec[];
  sizeMatrix: ProgramSizeMatrixItem[];
  colorMatrix: ProgramColorMatrixItem[];
  bomItems: ProgramBOMItem[];
  routeSteps: ProgramRouteStep[];
}

// Challan Item with Traceability Genealogy
export interface ChallanItem {
  id?: string;
  challanId?: string;
  itemDescription: string;
  fabricCode?: string;
  colour?: string;
  shade?: string;
  size?: string;
  unitType: ProductionUnitType;
  rollNumber?: string;
  lotNumber?: string;
  bundleNumber?: string;
  barcode?: string;
  quantity: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  uom: string;
  remarks?: string;
  
  // Genealogy Links
  sourceLotId?: string;
  sourceRollId?: string;
  sourceBundleId?: string;
}

// Challan Header
export interface Challan {
  id: string;
  challanNumber: string; // e.g. CH-DYE-2026-000451
  challanType: ChallanType;
  programId: string;
  parentChallanId?: string;
  fromDepartment: DepartmentCode;
  toDepartment: DepartmentCode;
  status: ChallanStatus;
  priority: PriorityLevel;
  issuedDate?: string;
  receivedDate?: string;
  completedDate?: string;
  createdById: string;
  issuedById?: string;
  receivedById?: string;
  approvedById?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  
  items: ChallanItem[];
}

// Production Accounting Mathematical Equation
// INPUT = GOOD + REWORK + REJECT + WASTE + BALANCE
export interface ProductionAccountingTransaction {
  id: string;
  programId: string;
  challanId: string;
  departmentCode: DepartmentCode;
  operationName: string;
  operatorId: string;
  machineId?: string;
  shift?: string;
  
  inputQuantity: number;
  goodQuantity: number;
  reworkQuantity: number;
  rejectQuantity: number;
  wasteQuantity: number;
  balanceQuantity: number;
  
  unitOfMeasure: string;
  reworkReason?: string;
  rejectReason?: string;
  wasteReason?: string;
  notes?: string;
  recordedAt: string;
}

// Quality Inspection
export interface QualityInspectionRecord {
  id: string;
  challanId: string;
  programId: string;
  departmentCode: DepartmentCode;
  inspectorId: string;
  sampleSize: number;
  defectsCount: number;
  status: QualityStatus;
  defectBreakdown: Array<{
    defectType: string;
    count: number;
    severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  }>;
  notes?: string;
  inspectedAt: string;
}

// Audit Trail Record
export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorName: string;
  action: AuditEventType;
  entity: string;
  entityId: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Verification Helper for Production Accounting
export function validateProductionBalance(accounting: {
  inputQuantity: number;
  goodQuantity: number;
  reworkQuantity: number;
  rejectQuantity: number;
  wasteQuantity: number;
  balanceQuantity?: number;
}): { isValid: boolean; expectedInput: number; error?: string } {
  const good = Math.max(0, accounting.goodQuantity || 0);
  const rework = Math.max(0, accounting.reworkQuantity || 0);
  const reject = Math.max(0, accounting.rejectQuantity || 0);
  const waste = Math.max(0, accounting.wasteQuantity || 0);
  const balance = Math.max(0, accounting.balanceQuantity || 0);
  const totalAccounted = good + rework + reject + waste + balance;

  if (accounting.inputQuantity < 0) {
    return { isValid: false, expectedInput: totalAccounted, error: 'Input quantity cannot be negative' };
  }
  if (totalAccounted !== accounting.inputQuantity) {
    return {
      isValid: false,
      expectedInput: totalAccounted,
      error: `Accounting imbalance: Input (${accounting.inputQuantity}) does not equal Good (${good}) + Rework (${rework}) + Reject (${reject}) + Waste (${waste}) + Balance (${balance}) = Total (${totalAccounted})`
    };
  }
  return { isValid: true, expectedInput: totalAccounted };
}
