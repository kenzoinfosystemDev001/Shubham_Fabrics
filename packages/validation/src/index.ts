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
} from '@subham/types';

// Auth validation
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
  role: z.nativeEnum(UserRole),
  departmentCode: z.nativeEnum(DepartmentCode).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Program File validation
export const FabricComponentSchema = z.object({
  fabricCode: z.string().min(1, 'Fabric code is required'),
  fabricName: z.string().min(1, 'Fabric name is required'),
  fabricType: z.string().default('Knitted'),
  composition: z.string().min(1, 'Composition is required (e.g. 100% Cotton)'),
  widthInInches: z.number().positive('Width must be positive'),
  gsm: z.number().positive('GSM must be positive'),
  colour: z.string().min(1, 'Colour is required'),
  shade: z.string().min(1, 'Shade is required'),
  requiredQuantity: z.number().positive('Required quantity must be positive'),
  tolerancePercentage: z.number().min(0).max(50).default(5),
  supplier: z.string().min(1, 'Supplier is required'),
});

export const MeasurementSpecSchema = z.object({
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
});

export const SizeMatrixItemSchema = z.object({
  size: z.string().min(1),
  targetQuantity: z.number().int().nonnegative('Quantity cannot be negative'),
});

export const ColorMatrixItemSchema = z.object({
  colorCode: z.string().min(1),
  colorName: z.string().min(1),
  pantoneReference: z.string().optional(),
  shade: z.string().min(1),
  targetQuantity: z.number().int().nonnegative(),
});

export const BOMItemSchema = z.object({
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  category: z.enum([
    'MAIN_FABRIC',
    'LINING',
    'THREAD',
    'BUTTON',
    'ZIP',
    'LABEL',
    'TAG',
    'PACKING_BAG',
    'CARTON',
    'EMBROIDERY_THREAD',
    'INTERLINING',
    'OTHER_TRIM',
  ]),
  requiredQuantityPerPiece: z.number().positive(),
  uom: z.string().min(1),
  wastagePercentage: z.number().min(0).max(100).default(2),
  totalRequiredQuantity: z.number().positive(),
  supplier: z.string().optional(),
});

export const RouteStepSchema = z.object({
  sequenceOrder: z.number().int().positive(),
  departmentCode: z.nativeEnum(DepartmentCode),
  standardCycleTimeMinutes: z.number().nonnegative().optional(),
  isMandatory: z.boolean().default(true),
  requiresQCGate: z.boolean().default(false),
});

export const CreateProgramSchema = z.object({
  programNumber: z.string().regex(/^PRG-\d{4}-\d{4,}$/, 'Program format must be PRG-YYYY-NNNN (e.g. PRG-2026-0001)'),
  programDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  buyer: z.string().min(2, 'Buyer/Customer name is required'),
  orderNumber: z.string().min(1, 'Order number is required'),
  designNumber: z.string().min(1, 'Design number is required'),
  designName: z.string().min(1, 'Design name is required'),
  designVersion: z.string().default('v1.0'),
  patternNumber: z.string().min(1, 'Pattern number is required'),
  styleCode: z.string().min(1, 'Style code is required'),
  productCategory: z.string().min(1, 'Product category is required (e.g. Polo Shirt, T-Shirt, Trousers)'),
  description: z.string().optional(),
  referenceImageUrl: z.string().url().optional().or(z.literal('')),
  technicalDrawingUrl: z.string().url().optional().or(z.literal('')),
  specificationSheetUrl: z.string().url().optional().or(z.literal('')),
  targetQuantity: z.number().int().positive('Target quantity must be greater than zero'),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Delivery date must be YYYY-MM-DD'),
  priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.NORMAL),
  
  fabrics: z.array(FabricComponentSchema).min(1, 'At least one fabric component is required'),
  measurements: z.array(MeasurementSpecSchema).min(1, 'Measurement specs are required'),
  sizeMatrix: z.array(SizeMatrixItemSchema).min(1, 'Size distribution is required'),
  colorMatrix: z.array(ColorMatrixItemSchema).min(1, 'Color distribution is required'),
  bomItems: z.array(BOMItemSchema).min(1, 'At least one BOM trim/material item is required'),
  routeSteps: z.array(RouteStepSchema).min(2, 'Production route must contain at least 2 department steps'),
}).superRefine((data, ctx) => {
  // Validate that sum of size matrix target quantities matches total target quantity
  const sizeTotal = data.sizeMatrix.reduce((sum, item) => sum + item.targetQuantity, 0);
  if (sizeTotal !== data.targetQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total size matrix quantity (${sizeTotal}) does not match Program target quantity (${data.targetQuantity})`,
      path: ['sizeMatrix'],
    });
  }

  // Validate route sequence ordering
  const orders = data.routeSteps.map(s => s.sequenceOrder);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Route steps must have unique sequential orders',
      path: ['routeSteps'],
    });
  }
});
export type CreateProgramInput = z.infer<typeof CreateProgramSchema>;

// Challan System Validation
export const ChallanItemSchema = z.object({
  itemDescription: z.string().min(1, 'Item description is required'),
  fabricCode: z.string().optional(),
  colour: z.string().optional(),
  shade: z.string().optional(),
  size: z.string().optional(),
  unitType: z.nativeEnum(ProductionUnitType),
  rollNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  bundleNumber: z.string().optional(),
  barcode: z.string().optional(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  grossWeightKg: z.number().nonnegative().optional(),
  netWeightKg: z.number().nonnegative().optional(),
  uom: z.string().min(1, 'UOM is required (e.g. MTR, KG, PCS)'),
  remarks: z.string().optional(),
  
  // Genealogy Links
  sourceLotId: z.string().optional(),
  sourceRollId: z.string().optional(),
  sourceBundleId: z.string().optional(),
});

export const CreateChallanSchema = z.object({
  challanNumber: z.string().regex(/^CH-[A-Z0-9]+-\d{4}-\d{4,}$/, 'Challan format must be CH-<DEPT>-YYYY-NNNN (e.g. CH-DYE-2026-000451)'),
  challanType: z.nativeEnum(ChallanType),
  programId: z.string().uuid('Program ID must be a valid UUID'),
  parentChallanId: z.string().uuid().optional(),
  fromDepartment: z.nativeEnum(DepartmentCode),
  toDepartment: z.nativeEnum(DepartmentCode),
  priority: z.nativeEnum(PriorityLevel).default(PriorityLevel.NORMAL),
  remarks: z.string().optional(),
  items: z.array(ChallanItemSchema).min(1, 'Challan must contain at least one item'),
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

// Strict Production Accounting Validation
export const RecordProductionAccountingSchema = z.object({
  programId: z.string().uuid(),
  challanId: z.string().uuid(),
  departmentCode: z.nativeEnum(DepartmentCode),
  operationName: z.string().min(1, 'Operation name is required'),
  operatorId: z.string().uuid(),
  machineId: z.string().optional(),
  shift: z.string().optional(),
  
  inputQuantity: z.number().positive('Input quantity must be positive'),
  goodQuantity: z.number().nonnegative('Good quantity cannot be negative'),
  reworkQuantity: z.number().nonnegative('Rework quantity cannot be negative').default(0),
  rejectQuantity: z.number().nonnegative('Reject quantity cannot be negative').default(0),
  wasteQuantity: z.number().nonnegative('Waste quantity cannot be negative').default(0),
  balanceQuantity: z.number().nonnegative('Balance quantity cannot be negative').default(0),
  
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
      message: `Production balance violation! Input (${data.inputQuantity}) != Good (${data.goodQuantity}) + Rework (${data.reworkQuantity}) + Reject (${data.rejectQuantity}) + Waste (${data.wasteQuantity}) + Balance (${data.balanceQuantity}). Total accounted: ${sum}`,
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

// Quality Inspection Validation
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
