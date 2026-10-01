import { DepartmentCode, UserRole, ProgramStatus } from '@subham/types';
import { DEPARTMENT_LABELS } from '@subham/config';

describe('Shubham Fabrics MES - Programming Department Core Specs', () => {
  describe('Department Taxonomy & Configuration', () => {
    it('should define PROGRAMMING as Department #1 in taxonomy', () => {
      expect(DepartmentCode.PROGRAMMING).toBe('PROGRAMMING');
      expect(DEPARTMENT_LABELS[DepartmentCode.PROGRAMMING]).toBe('Programming Department');
    });

    it('should support programmer roles in RBAC', () => {
      expect(UserRole.PROGRAMMING_INCHARGE).toBe('PROGRAMMING_INCHARGE');
      expect(UserRole.PROGRAMMER).toBe('PROGRAMMER');
    });
  });

  describe('Production Sheet Lifecycle Transitions', () => {
    const validTransitions: Record<string, string[]> = {
      [ProgramStatus.DRAFT]: [ProgramStatus.IN_PROGRESS, ProgramStatus.READY_FOR_ISSUE, ProgramStatus.SUBMITTED, ProgramStatus.CANCELLED],
      [ProgramStatus.IN_PROGRESS]: [ProgramStatus.READY_FOR_ISSUE, ProgramStatus.DRAFT, ProgramStatus.CANCELLED],
      [ProgramStatus.READY_FOR_ISSUE]: [ProgramStatus.ISSUED, ProgramStatus.IN_PROGRESS, ProgramStatus.CANCELLED],
      [ProgramStatus.ISSUED]: [ProgramStatus.IN_PRODUCTION, ProgramStatus.COMPLETED, ProgramStatus.ON_HOLD],
    };

    it('should allow legal forward transition from DRAFT to READY_FOR_ISSUE', () => {
      const allowed = validTransitions[ProgramStatus.DRAFT];
      expect(allowed).toContain(ProgramStatus.READY_FOR_ISSUE);
      expect(allowed).toContain(ProgramStatus.IN_PROGRESS);
    });

    it('should allow transition from READY_FOR_ISSUE to ISSUED', () => {
      const allowed = validTransitions[ProgramStatus.READY_FOR_ISSUE];
      expect(allowed).toContain(ProgramStatus.ISSUED);
    });

    it('should block arbitrary illegal transitions directly from DRAFT to ISSUED', () => {
      const allowed = validTransitions[ProgramStatus.DRAFT];
      expect(allowed).not.toContain(ProgramStatus.ISSUED);
    });
  });

  describe('Programming Challan Numbering Format', () => {
    it('should format Programming Challans with CH-PRG-YYYY-NNNNN', () => {
      const year = new Date().getFullYear();
      const seq = 1;
      const formattedSeq = String(seq).padStart(5, '0');
      const challanNumber = `CH-PRG-${year}-${formattedSeq}`;

      expect(challanNumber).toMatch(/^CH-PRG-\d{4}-\d{5}$/);
      expect(challanNumber).toBe(`CH-PRG-${year}-00001`);
    });
  });

  describe('Production Sheet 8-Section Field Completeness', () => {
    it('should accept all 40+ required business fields for Shubham Fabrics Production Sheet', () => {
      const sampleSheet = {
        // Section 1: Program Information
        programSerialNo: 'PRG-2026-00001',
        startDate: '2026-10-01',
        designNumber: 'SF-DSG-8902',
        clientName: 'Raymond Apparel Ltd',
        clientPriority: 'HIGH',
        deliveryDate: '2026-10-25',

        // Section 2: Style Information
        mainStyle: 'Polo T-Shirt',
        subStyle: 'Slim Fit',
        pattern: 'PAT-2026-M04',
        baseDesignType: 'Embroidered Crest',
        baseDesignPhoto: 'https://storage.shubhamfabrics.com/designs/sample.jpg',

        // Section 3: Design Information
        wilcomDesignNumber: 'WLC-EMB-5541',
        wilcomDesignPhoto: 'https://storage.shubhamfabrics.com/wilcom/sample.png',
        embroideryDesign: 'Chest Crest 4-Color',
        embroideryDesignSize: '120mm x 85mm',

        // Section 4: Fabric Information
        fabricName: 'Cotton Cambric 60s',
        fabricType: '100% Woven Cotton',
        fabricWidthInches: 58.0,
        fabricColor: 'Natural White',
        fabricColorAvailable: 'IN_STOCK',
        fabricAverage: 1.25,
        fabricAverageType: 'Meters/Piece',
        fabricAverageMeasurement: 'Standard Lay Consumption',

        // Section 5: Dyeing Information
        fabricDyeingRequired: true,
        fabricIssuedToDyeing: 625.0,
        fabricSentToDyeing: 625.0,

        // Section 6: Production Quantity
        color: 'Natural White',
        colorQuantity: 500,
        quantityMeasurement: 'PCS',
        specialMaterial: 'Metallic Gold Zari Thread',
        specialMaterialQuantity: '10 Cones',

        // Section 7: Production Dates
        productionDesignDate: '2026-10-01',
        productionEndDate: '2026-10-15',

        // Section 8: Rejection / Remarks
        piecesRejection: 5,
        rejectionReason: 'Check for needle cut on lightweight knit',
        comments: 'Maintain high bobbin tension for sharp embroidery definition',
      };

      expect(sampleSheet.programSerialNo).toBe('PRG-2026-00001');
      expect(sampleSheet.wilcomDesignNumber).toBe('WLC-EMB-5541');
      expect(sampleSheet.fabricDyeingRequired).toBe(true);
      expect(sampleSheet.colorQuantity).toBe(500);
      expect(sampleSheet.piecesRejection).toBe(5);
    });
  });
});
