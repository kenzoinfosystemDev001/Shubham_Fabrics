import { validateProductionBalance, DepartmentCode, PriorityLevel, ProductionUnitType, ChallanType } from '@subham/types';
import { CreateProgramSchema, RecordProductionAccountingSchema, CreateChallanSchema } from '@subham/validation';

describe('Subham Fabrics MES - Business Critical Workflow Tests', () => {
  describe('Strict Production Accounting Equation (Input = Good + Rework + Reject + Waste + Balance)', () => {
    it('should validate exact production accounting balances', () => {
      const result = validateProductionBalance({
        inputQuantity: 1000,
        goodQuantity: 940,
        reworkQuantity: 30,
        rejectQuantity: 20,
        wasteQuantity: 10,
        balanceQuantity: 0,
      });

      expect(result.isValid).toBe(true);
      expect(result.expectedInput).toBe(1000);
      expect(result.error).toBeUndefined();
    });

    it('should reject production accounting imbalance with precise error', () => {
      const result = validateProductionBalance({
        inputQuantity: 1000,
        goodQuantity: 900,
        reworkQuantity: 20,
        rejectQuantity: 20,
        wasteQuantity: 10,
        balanceQuantity: 0,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Accounting imbalance: Input (1000) does not equal');
      expect(result.expectedInput).toBe(950);
    });

    it('should reject negative inputs', () => {
      const result = validateProductionBalance({
        inputQuantity: -100,
        goodQuantity: 100,
        reworkQuantity: 0,
        rejectQuantity: 0,
        wasteQuantity: 0,
        balanceQuantity: 0,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be negative');
    });

    it('should validate schema constraints via RecordProductionAccountingSchema', () => {
      const validPayload = {
        programId: '123e4567-e89b-12d3-a456-426614174000',
        challanId: '123e4567-e89b-12d3-a456-426614174001',
        departmentCode: DepartmentCode.CUTTING,
        operationName: 'Spreading and Lay Cutting',
        operatorId: '123e4567-e89b-12d3-a456-426614174002',
        inputQuantity: 500,
        goodQuantity: 470,
        reworkQuantity: 10,
        rejectQuantity: 10,
        wasteQuantity: 10,
        balanceQuantity: 0,
        unitOfMeasure: 'KG',
        reworkReason: 'Fabric edge alignment flaw',
        rejectReason: 'Hole across marker body',
      };

      const parsed = RecordProductionAccountingSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('should require reworkReason when reworkQuantity > 0', () => {
      const missingReasonPayload = {
        programId: '123e4567-e89b-12d3-a456-426614174000',
        challanId: '123e4567-e89b-12d3-a456-426614174001',
        departmentCode: DepartmentCode.CUTTING,
        operationName: 'Spreading and Lay Cutting',
        operatorId: '123e4567-e89b-12d3-a456-426614174002',
        inputQuantity: 500,
        goodQuantity: 480,
        reworkQuantity: 20,
        rejectQuantity: 0,
        wasteQuantity: 0,
        balanceQuantity: 0,
        unitOfMeasure: 'KG',
        reworkReason: '', // Empty
      };

      const parsed = RecordProductionAccountingSchema.safeParse(missingReasonPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('Rework reason is mandatory');
      }
    });
  });

  describe('Program Specification & Routing Validation', () => {
    it('should reject a program where size matrix sum does not equal target quantity', () => {
      const programPayload = {
        programNumber: 'PRG-2026-9999',
        programDate: '2026-09-30',
        buyerName: 'Marks & Spencer',
        orderNumber: 'PO-MS-1234',
        designNumber: 'DES-881',
        designName: 'Classic Crew Tee',
        designVersion: 'v1.0',
        patternNumber: 'PAT-881-A',
        styleCode: 'CREW-TEE-01',
        productCategory: 'T-Shirts',
        targetQuantity: 1000,
        deliveryDate: '2026-10-30',
        priority: PriorityLevel.NORMAL,
        fabrics: [
          {
            fabricCode: 'FAB-SNG-01',
            fabricName: 'Single Jersey',
            fabricType: 'Knit',
            composition: '100% Cotton',
            widthInInches: 60,
            gsm: 180,
            colour: 'Navy',
            shade: 'Dark',
            requiredQuantity: 300,
            tolerancePercentage: 5,
            supplier: 'Vardhman',
          },
        ],
        measurements: [
          {
            size: 'M',
            length: 70,
            chest: 52,
            waist: 50,
            shoulder: 44,
            sleeveLength: 22,
            armhole: 24,
            neck: 40,
            bottom: 52,
          },
        ],
        sizeMatrix: [
          { size: 'M', targetQuantity: 800 }, // Only 800 vs 1000 target!
        ],
        colorMatrix: [
          { colorCode: 'NAVY', colorName: 'Navy', shade: 'Dark', targetQuantity: 1000 },
        ],
        bomItems: [
          {
            itemCode: 'THRD-01',
            itemName: 'Cotton Thread',
            category: 'THREAD',
            requiredQuantityPerPiece: 80,
            uom: 'MTR',
            wastagePercentage: 2,
            totalRequiredQuantity: 81600,
          },
        ],
        routeSteps: [
          { sequenceOrder: 1, departmentCode: DepartmentCode.STORE },
          { sequenceOrder: 2, departmentCode: DepartmentCode.CUTTING },
        ],
      };

      const parsed = CreateProgramSchema.safeParse(programPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('Total size matrix quantity (800) does not match Program target quantity (1000)');
      }
    });
  });

  describe('Challan System & Genealogy Validation', () => {
    it('should reject a challan where source and destination departments are identical', () => {
      const challanPayload = {
        challanNumber: 'CH-CUT-2026-000001',
        challanType: ChallanType.INTER_DEPARTMENT,
        programId: '123e4567-e89b-12d3-a456-426614174000',
        fromDepartment: DepartmentCode.CUTTING,
        toDepartment: DepartmentCode.CUTTING, // Same!
        items: [
          {
            itemDescription: 'Cut Pieces',
            unitType: ProductionUnitType.BUNDLE,
            quantity: 50,
            uom: 'PCS',
          },
        ],
      };

      const parsed = CreateChallanSchema.safeParse(challanPayload);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('Source and Destination departments cannot be identical');
      }
    });
  });
});
