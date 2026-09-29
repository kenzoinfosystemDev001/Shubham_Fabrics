import { z } from 'zod';
import {
  UserRole,
  DepartmentCode,
  ProgramStatus,
  PriorityLevel,
  ChallanStatus,
  ChallanType,
  ProductionUnitType,
  QualityStatus,
  StockLedgerEntryType,
  ChallanAction,
  DefectStatus,
  ReworkStatus,
  RecutStatus,
  FabricRollStatus,
  BundleStatus,
  CartonStatus,
  DispatchStatus,
  QCResultStatus,
} from '@subham/types';

// ==========================================
// 1. AUTH & RBAC VALIDATION
// ==========================================

export const LoginSchema = z.object({
  usernameOrEmail: z.string().min(3, 'Username or Email is required').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters with numbers and symbols'),
  roleCode: z.string().default('VIEWER'),
  departmentCode: z.nativeEnum(DepartmentCode).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const AssignUserRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const CreateRoleSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_]+$/, 'Role code must be uppercase letters, numbers and underscores'),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).default([]),
});

// ==========================================
// 2. MASTER DATA VALIDATION
// ==========================================

// Supplier Master
export const CreateSupplierSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Z0-9-]+$/, 'Uppercase alphanumeric & hyphen'),
  name: z.string().min(2).max(150),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  rating: z.number().min(1).max(5).default(5.0),
});
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;

export const UpdateSupplierSchema = CreateSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Customer Master
export const CreateCustomerSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Z0-9-]+$/, 'Uppercase alphanumeric & hyphen'),
  name: z.string().min(2).max(150),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().default('India'),
  buyerGroup: z.string().optional(),
  currency: z.string().default('INR'),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Fabric Master
export const CreateFabricMasterSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(150),
  fabricType: z.string().min(1),
  composition: z.string().min(1),
  widthInInches: z.number().positive(),
  gsm: z.number().positive(),
  weaveType: z.string().optional(),
  supplierId: z.string().uuid().optional().or(z.literal('')),
});
export type CreateFabricMasterInput = z.infer<typeof CreateFabricMasterSchema>;

// Trim Master
export const CreateTrimSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(150),
  trimCategory: z.string().min(1),
  specification: z.string().optional(),
  uom: z.string().min(1),
  supplierId: z.string().uuid().optional().or(z.literal('')),
});
export type CreateTrimInput = z.infer<typeof CreateTrimSchema>;

// Design Master
export const CreateDesignSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(150),
  designVersion: z.string().default('v1.0'),
  season: z.string().optional(),
  patternNumber: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  customerId: z.string().uuid().optional().or(z.literal('')),
});
export type CreateDesignInput = z.infer<typeof CreateDesignSchema>;

// Colour Master
export const CreateColourSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(100),
  hexCode: z.string().optional(),
  pantoneCode: z.string().optional(),
});
export type CreateColourInput = z.infer<typeof CreateColourSchema>;

// Size Master
export const CreateSizeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  sortOrder: z.number().int().default(1),
  sizeGroup: z.string().default('ADULT'),
});
export type CreateSizeInput = z.infer<typeof CreateSizeSchema>;

// Department Master
export const CreateDepartmentSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Z0-9_]+$/, 'Uppercase alphanumeric & underscore'),
  name: z.string().min(2).max(100),
  sequenceOrder: z.number().int().positive(),
  description: z.string().optional(),
});
export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;

// Work Center Master
export const CreateWorkCenterSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(100),
  departmentId: z.string().uuid(),
  capacityPerHour: z.number().nonnegative().default(0),
});
export type CreateWorkCenterInput = z.infer<typeof CreateWorkCenterSchema>;

// Machine Master
export const CreateMachineSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(100),
  machineType: z.string().min(1),
  workCenterId: z.string().uuid(),
  serialNumber: z.string().optional(),
  status: z.enum(['OPERATIONAL', 'MAINTENANCE', 'BREAKDOWN']).default('OPERATIONAL'),
});
export type CreateMachineInput = z.infer<typeof CreateMachineSchema>;

// Shift Master
export const CreateShiftSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(100),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
  durationHours: z.number().positive().default(8.0),
});
export type CreateShiftInput = z.infer<typeof CreateShiftSchema>;

// Operation Master
export const CreateOperationSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(150),
  departmentId: z.string().uuid(),
  standardCycleTimeSeconds: z.number().positive().default(60),
  difficultyLevel: z.enum(['SIMPLE', 'STANDARD', 'COMPLEX']).default('STANDARD'),
  pieceRate: z.number().nonnegative().default(0),
});
export type CreateOperationInput = z.infer<typeof CreateOperationSchema>;

// Defect Code Master
export const CreateDefectCodeSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(150),
  category: z.string().min(1),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).default('MAJOR'),
});
export type CreateDefectCodeInput = z.infer<typeof CreateDefectCodeSchema>;

// ==========================================
// 3. PROGRAM FILE VALIDATION
// ==========================================

export const FabricComponentSchema = z.object({
  fabricId: z.string().uuid().optional(),
  fabricCode: z.string().min(1, 'Fabric code is required'),
  fabricName: z.string().min(1, 'Fabric name is required'),
  composition: z.string().min(1, 'Composition is required (e.g. 100% Cotton)'),
  widthInInches: z.number().positive('Width must be positive'),
  gsm: z.number().positive('GSM must be positive'),
  colourId: z.string().uuid().optional(),
  colour: z.string().min(1, 'Colour is required'),
  shade: z.string().optional(),
  requiredQuantity: z.number().positive('Required quantity must be positive'),
  tolerancePercentage: z.number().min(0).max(50).default(5),
  wastagePercentage: z.number().min(0).max(50).default(3),
});

export const MeasurementSpecSchema = z.object({
  sizeId: z.string().uuid().optional(),
  size: z.string().min(1, 'Size is required (e.g. S, M, L, XL)'),
  length: z.number().positive(),
  chest: z.number().positive(),
  waist: z.number().positive(),
  shoulder: z.number().positive(),
  sleeveLength: z.number().positive(),
  armhole: z.number().positive(),
  neck: z.number().positive(),
  bottom: z.number().positive(),
  otherSpecs: z.record(z.number()).optional(),
  toleranceMm: z.number().default(5.0),
});

export const SizeMatrixItemSchema = z.object({
  sizeId: z.string().uuid().optional(),
  size: z.string().min(1),
  targetQuantity: z.number().int().nonnegative('Quantity cannot be negative'),
});

export const ColorMatrixItemSchema = z.object({
  colourId: z.string().uuid().optional(),
  colorCode: z.string().min(1),
  colorName: z.string().min(1),
  shade: z.string().optional(),
  targetQuantity: z.number().int().nonnegative(),
});

export const BOMItemSchema = z.object({
  itemId: z.string().uuid().optional(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  category: z.string().min(1),
  requiredQuantityPerPiece: z.number().positive(),
  uom: z.string().min(1),
  wastagePercentage: z.number().min(0).max(100).default(2),
  totalRequiredQuantity: z.number().positive(),
  supplierId: z.string().uuid().optional().or(z.literal('')),
});

export const RouteStepSchema = z.object({
  sequenceOrder: z.number().int().positive(),
  departmentCode: z.string().min(1),
  operationId: z.string().uuid().optional().or(z.literal('')),
  isMandatory: z.boolean().default(true),
  requiresQCGate: z.boolean().default(false),
  expectedDurationMinutes: z.number().nonnegative().default(45.0),
  inputType: z.string().default('CUT_PANEL'),
  outputType: z.string().default('PIECE'),
  reworkAllowed: z.boolean().default(true),
  skipAllowed: z.boolean().default(false),
  isParallel: z.boolean().default(false),
});

export const CreateProgramSchema = z.object({
  programNumber: z.string().regex(/^PRG-\d{4}-\d{4,}$/, 'Format must be PRG-YYYY-NNNN (e.g. PRG-2026-0001)'),
  programDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  customerId: z.string().uuid().optional(),
  buyerName: z.string().min(2, 'Buyer name is required'),
  orderNumber: z.string().min(1, 'Order number is required'),
  designId: z.string().uuid().optional(),
  designName: z.string().min(1, 'Design name is required'),
  styleCode: z.string().min(1, 'Style code is required'),
  productCategory: z.string().min(1, 'Product category is required'),
  targetQuantity: z.number().int().positive('Target quantity must be greater than zero'),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Delivery date format must be YYYY-MM-DD'),
  priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.NORMAL),
  remarks: z.string().optional(),

  fabrics: z.array(FabricComponentSchema).min(1, 'At least one fabric is required'),
  measurements: z.array(MeasurementSpecSchema).min(1, 'Measurement specs are required'),
  sizeMatrix: z.array(SizeMatrixItemSchema).min(1, 'Size distribution is required'),
  colorMatrix: z.array(ColorMatrixItemSchema).min(1, 'Color distribution is required'),
  bomItems: z.array(BOMItemSchema).min(1, 'At least one BOM item is required'),
  routeSteps: z.array(RouteStepSchema).min(2, 'Route must have at least 2 steps'),
}).superRefine((data, ctx) => {
  const sizeTotal = data.sizeMatrix.reduce((sum, item) => sum + item.targetQuantity, 0);
  if (sizeTotal !== data.targetQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total size matrix quantity (${sizeTotal}) does not match Program target quantity (${data.targetQuantity})`,
      path: ['sizeMatrix'],
    });
  }
});
export type CreateProgramInput = z.infer<typeof CreateProgramSchema>;

// ==========================================
// 4. CHALLAN & PRODUCTION VALIDATION
// ==========================================

export const ChallanItemSchema = z.object({
  itemDescription: z.string().min(1),
  fabricCode: z.string().optional(),
  colour: z.string().optional(),
  shade: z.string().optional(),
  size: z.string().optional(),
  unitType: z.nativeEnum(ProductionUnitType),
  rollNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  bundleNumber: z.string().optional(),
  barcode: z.string().optional(),
  quantity: z.number().positive(),
  grossWeightKg: z.number().nonnegative().optional(),
  netWeightKg: z.number().nonnegative().optional(),
  uom: z.string().min(1),
  remarks: z.string().optional(),
  sourceLotId: z.string().optional(),
  sourceRollId: z.string().optional(),
  sourceBundleId: z.string().optional(),
});

export const CreateChallanSchema = z.object({
  challanNumber: z.string().regex(/^CH-[A-Z0-9]+-\d{4}-\d{4,}$/, 'Format: CH-<DEPT>-YYYY-NNNN'),
  challanType: z.nativeEnum(ChallanType),
  programId: z.string().uuid(),
  parentChallanId: z.string().uuid().optional(),
  fromDepartment: z.nativeEnum(DepartmentCode),
  toDepartment: z.nativeEnum(DepartmentCode),
  priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.NORMAL),
  remarks: z.string().optional(),
  items: z.array(ChallanItemSchema).min(1),
}).superRefine((data, ctx) => {
  if (data.fromDepartment === data.toDepartment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Source and Destination departments cannot be identical',
      path: ['toDepartment'],
    });
  }
});
export type CreateChallanInput = z.infer<typeof CreateChallanSchema>;

export const RecordProductionAccountingSchema = z.object({
  programId: z.string().uuid(),
  challanId: z.string().uuid(),
  departmentCode: z.nativeEnum(DepartmentCode),
  operationName: z.string().min(1),
  operatorId: z.string().uuid(),
  machineId: z.string().optional(),
  shift: z.string().optional(),
  inputQuantity: z.number().positive(),
  goodQuantity: z.number().nonnegative(),
  reworkQuantity: z.number().nonnegative().default(0),
  rejectQuantity: z.number().nonnegative().default(0),
  wasteQuantity: z.number().nonnegative().default(0),
  balanceQuantity: z.number().nonnegative().default(0),
  unitOfMeasure: z.string().min(1),
  reworkReason: z.string().optional(),
  rejectReason: z.string().optional(),
  wasteReason: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  const sum = data.goodQuantity + data.reworkQuantity + data.rejectQuantity + data.wasteQuantity + data.balanceQuantity;
  if (sum !== data.inputQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Production balance violation! Input (${data.inputQuantity}) != Good (${data.goodQuantity}) + Rework (${data.reworkQuantity}) + Reject (${data.rejectQuantity}) + Waste (${data.wasteQuantity}) + Balance (${data.balanceQuantity}). Total: ${sum}`,
      path: ['inputQuantity'],
    });
  }
  if (data.reworkQuantity > 0 && (!data.reworkReason || data.reworkReason.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Rework reason is mandatory when rework quantity > 0',
      path: ['reworkReason'],
    });
  }
  if (data.rejectQuantity > 0 && (!data.rejectReason || data.rejectReason.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reject reason is mandatory when reject quantity > 0',
      path: ['rejectReason'],
    });
  }
});
export type RecordProductionAccountingInput = z.infer<typeof RecordProductionAccountingSchema>;

export const DefectDetailSchema = z.object({
  defectType: z.string().min(1),
  count: z.number().int().positive(),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']),
});

export const QualityInspectionSchema = z.object({
  challanId: z.string().uuid(),
  programId: z.string().uuid(),
  departmentCode: z.nativeEnum(DepartmentCode),
  sampleSize: z.number().int().positive(),
  status: z.nativeEnum(QualityStatus),
  defects: z.array(DefectDetailSchema).default([]),
  notes: z.string().optional(),
});
export type QualityInspectionInput = z.infer<typeof QualityInspectionSchema>;

// ==========================================
// 5. PHASE 2 — REAL EXECUTION ENGINE SCHEMAS
// ==========================================

// Stock Ledger Entry
export const CreateStockLedgerEntrySchema = z.object({
  entryType: z.nativeEnum(StockLedgerEntryType),
  departmentCode: z.nativeEnum(DepartmentCode),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  batchNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  rollNumber: z.string().optional(),
  colour: z.string().optional(),
  shade: z.string().optional(),
  location: z.string().optional(),
  quantity: z.number().refine((q) => q !== 0, 'Quantity cannot be zero'),
  weightKg: z.number().nonnegative().optional(),
  uom: z.string().min(1),
  referenceType: z.string().min(1),
  referenceId: z.string().optional(),
  programId: z.string().uuid().optional(),
  notes: z.string().optional(),
});
export type CreateStockLedgerEntryInput = z.infer<typeof CreateStockLedgerEntrySchema>;

// Fabric Roll Registration
export const RegisterFabricRollSchema = z.object({
  rollNumber: z.string().regex(/^ROLL-[A-Z0-9-]+$/, 'Roll format e.g. ROLL-001 or ROLL-SNG-001'),
  lotNumber: z.string().optional(),
  fabricCode: z.string().min(1),
  fabricName: z.string().min(1),
  colour: z.string().min(1),
  shade: z.string().optional(),
  initialLengthMtr: z.number().positive(),
  initialWeightKg: z.number().positive(),
  location: z.string().optional(),
  programId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
});
export type RegisterFabricRollInput = z.infer<typeof RegisterFabricRollSchema>;

// Challan Action State Machine Transition
export const ChallanActionSchema = z.object({
  action: z.nativeEnum(ChallanAction),
  reason: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
export type ChallanActionInput = z.infer<typeof ChallanActionSchema>;

// Bundle Generation
export const CreateBundleSchema = z.object({
  bundleNumber: z.string().regex(/^BND-[A-Z0-9-]+$/, 'Bundle format e.g. BND-2026-0001'),
  programId: z.string().uuid(),
  challanId: z.string().uuid().optional(),
  rollId: z.string().uuid().optional(),
  rollNumber: z.string().optional(),
  layNumber: z.string().optional(),
  markerNumber: z.string().optional(),
  patternNumber: z.string().optional(),
  size: z.string().min(1),
  colour: z.string().min(1),
  shade: z.string().optional(),
  quantity: z.number().int().positive('Bundle quantity must be positive'),
  currentDepartment: z.nativeEnum(DepartmentCode).default(DepartmentCode.CUTTING),
});
export type CreateBundleInput = z.infer<typeof CreateBundleSchema>;

// Carton Packing
export const CreateCartonSchema = z.object({
  cartonNumber: z.string().regex(/^CTN-[A-Z0-9-]+$/, 'Carton format e.g. CTN-2026-0001'),
  programId: z.string().uuid(),
  packingChallanId: z.string().uuid().optional(),
  size: z.string().min(1),
  colour: z.string().min(1),
  quantity: z.number().int().positive(),
  grossWeightKg: z.number().positive().optional(),
  netWeightKg: z.number().positive().optional(),
  locationRack: z.string().optional(),
  locationShelf: z.string().optional(),
  bundleIds: z.array(z.string().uuid()).min(1, 'Carton must include at least one bundle'),
});
export type CreateCartonInput = z.infer<typeof CreateCartonSchema>;

// Dispatch Order
export const CreateDispatchOrderSchema = z.object({
  dispatchNumber: z.string().regex(/^DSP-[A-Z0-9-]+$/, 'Dispatch format e.g. DSP-2026-0001'),
  customerId: z.string().uuid().optional(),
  orderNumber: z.string().min(1),
  invoiceNumber: z.string().optional(),
  transporterName: z.string().min(1),
  vehicleNumber: z.string().min(1),
  lrNumber: z.string().optional(),
  destination: z.string().min(1),
  cartonIds: z.array(z.string().uuid()).min(1, 'Dispatch order must contain at least one carton'),
  notes: z.string().optional(),
});
export type CreateDispatchOrderInput = z.infer<typeof CreateDispatchOrderSchema>;

// Central Defect Recording
export const CreateDefectRecordSchema = z.object({
  defectCode: z.string().min(1),
  programId: z.string().uuid(),
  challanId: z.string().uuid().optional(),
  departmentCode: z.nativeEnum(DepartmentCode),
  bundleId: z.string().uuid().optional(),
  itemDescription: z.string().min(1),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']),
  quantity: z.number().int().positive(),
  reason: z.string().min(2, 'Defect reason is required'),
});
export type CreateDefectRecordInput = z.infer<typeof CreateDefectRecordSchema>;

// Rework Transaction
export const CreateReworkTransactionSchema = z.object({
  defectId: z.string().uuid(),
  programId: z.string().uuid(),
  sourceTransactionId: z.string().uuid().optional(),
  departmentCode: z.nativeEnum(DepartmentCode),
  operationName: z.string().min(1),
  operatorId: z.string().uuid(),
  inputQuantity: z.number().int().positive(),
  outputGoodQuantity: z.number().int().nonnegative(),
  outputRejectQuantity: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.outputGoodQuantity + data.outputRejectQuantity > data.inputQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Output (Good + Reject) cannot exceed Input quantity in Rework',
      path: ['outputGoodQuantity'],
    });
  }
});
export type CreateReworkTransactionInput = z.infer<typeof CreateReworkTransactionSchema>;

// Re-cut Request (Exception Workflow)
export const CreateRecutRequestSchema = z.object({
  recutNumber: z.string().regex(/^REC-[A-Z0-9-]+$/, 'Format e.g. REC-2026-0001'),
  programId: z.string().uuid(),
  defectId: z.string().uuid(),
  originalBundleId: z.string().uuid().optional(),
  size: z.string().min(1),
  colour: z.string().min(1),
  requestedQuantity: z.number().int().positive(),
  reason: z.string().min(3, 'Detailed justification required for re-cutting'),
  notes: z.string().optional(),
});
export type CreateRecutRequestInput = z.infer<typeof CreateRecutRequestSchema>;

// Reusable QC with Template & Measured Values
export const QCParameterValueSchema = z.object({
  parameterName: z.string().min(1),
  expectedValue: z.string().optional(),
  measuredValue: z.string().min(1),
  tolerance: z.string().optional(),
  uom: z.string().optional(),
  status: z.enum(['PASS', 'FAIL', 'OBSERVATION']),
  comments: z.string().optional(),
});

export const ComprehensiveQCSchema = z.object({
  challanId: z.string().uuid(),
  programId: z.string().uuid(),
  departmentCode: z.nativeEnum(DepartmentCode),
  sampleSize: z.number().int().positive(),
  overallStatus: z.nativeEnum(QCResultStatus),
  parameters: z.array(QCParameterValueSchema).default([]),
  defects: z.array(DefectDetailSchema).default([]),
  notes: z.string().optional(),
});
export type ComprehensiveQCInput = z.infer<typeof ComprehensiveQCSchema>;

