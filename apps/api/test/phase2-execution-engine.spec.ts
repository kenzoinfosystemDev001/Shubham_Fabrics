import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { ProgramsService } from '../src/modules/programs/programs.service';
import { ChallansService } from '../src/modules/challans/challans.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { BundlesService } from '../src/modules/bundles/bundles.service';
import { DefectsService } from '../src/modules/defects/defects.service';
import { QualityService } from '../src/modules/quality/quality.service';
import { PackingService } from '../src/modules/packing/packing.service';
import { DispatchService } from '../src/modules/dispatch/dispatch.service';
import { ProductionService } from '../src/modules/production/production.service';
import { FloorBoardService } from '../src/modules/floorboard/floorboard.service';
import {
  DepartmentCode,
  PriorityLevel,
  ProgramStatus,
  ChallanStatus,
  ChallanType,
  ProductionUnitType,
  StockLedgerEntryType,
  QCResultStatus,
  DefectStatus,
  BundleStatus,
  CartonStatus,
  DispatchStatus,
  validateProductionBalance,
} from '@subham/types';

describe('MES Phase 2 Real Manufacturing Execution Engine (5,000 Pieces Target)', () => {
  jest.setTimeout(120000); // 2 minutes for full 14-step factory execution against remote Neon DB

  let app: INestApplication;
  let authService: AuthService;
  let programsService: ProgramsService;
  let challansService: ChallansService;
  let inventoryService: InventoryService;
  let bundlesService: BundlesService;
  let defectsService: DefectsService;
  let qualityService: QualityService;
  let packingService: PackingService;
  let dispatchService: DispatchService;
  let productionService: ProductionService;
  let floorBoardService: FloorBoardService;

  let adminUser: any;
  let programId: string;
  let storeChallanId: string;
  let dyeingChallanId: string;
  let cuttingChallanId: string;
  let bundleIds: string[] = [];
  let cartonIds: string[] = [];
  const suffix = Math.floor(Math.random() * 8000) + 1000;
  const programNumber = `PRG-2026-${suffix}`;
  const rollNumber1 = `ROLL-2026-${suffix}-1`;
  const rollNumber2 = `ROLL-2026-${suffix}-2`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    programsService = moduleFixture.get<ProgramsService>(ProgramsService);
    challansService = moduleFixture.get<ChallansService>(ChallansService);
    inventoryService = moduleFixture.get<InventoryService>(InventoryService);
    bundlesService = moduleFixture.get<BundlesService>(BundlesService);
    defectsService = moduleFixture.get<DefectsService>(DefectsService);
    qualityService = moduleFixture.get<QualityService>(QualityService);
    packingService = moduleFixture.get<PackingService>(PackingService);
    dispatchService = moduleFixture.get<DispatchService>(DispatchService);
    productionService = moduleFixture.get<ProductionService>(ProductionService);
    floorBoardService = moduleFixture.get<FloorBoardService>(FloorBoardService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('Step 1: Authenticate Admin Operator via Database RBAC', async () => {
    const authResult = await authService.login({
      usernameOrEmail: 'admin',
      password: 'Admin@12345',
    });

    expect(authResult).toBeDefined();
    expect(authResult.accessToken).toBeDefined();
    expect(authResult.user.role).toBe('SUPER_ADMIN');
    adminUser = authResult.user;
  });

  it('Step 2: Material Inward into Store & Stock Ledger Verification', async () => {
    // Register 2 Fabric Rolls: 1250 MTR each = 2500 MTR total
    const roll1 = await inventoryService.registerFabricRoll(
      {
        rollNumber: rollNumber1,
        lotNumber: `LOT-2026-${suffix}`,
        fabricCode: 'FAB-SNG-01',
        fabricName: 'Single Jersey 100% Combed Cotton',
        colour: 'Navy Blue',
        initialLengthMtr: 1250,
        initialWeightKg: 250,
        location: 'STORE-BAY-A',
      },
      adminUser.id,
    );

    const roll2 = await inventoryService.registerFabricRoll(
      {
        rollNumber: rollNumber2,
        lotNumber: `LOT-2026-${suffix}`,
        fabricCode: 'FAB-SNG-01',
        fabricName: 'Single Jersey 100% Combed Cotton',
        colour: 'Navy Blue',
        initialLengthMtr: 1250,
        initialWeightKg: 250,
        location: 'STORE-BAY-B',
      },
      adminUser.id,
    );

    expect(roll1.rollNumber).toBe(rollNumber1);
    expect(roll2.rollNumber).toBe(rollNumber2);

    // Verify Ledger Inward Entries
    const ledger = await inventoryService.getLedgerEntries({ rollNumber: rollNumber1 });
    expect(ledger.length).toBeGreaterThanOrEqual(1);
    expect(ledger[0].entryType).toBe(StockLedgerEntryType.RECEIPT);
    expect(ledger[0].departmentCode).toBe(DepartmentCode.STORE);
    expect(ledger[0].quantity).toBe(1250);
  });

  it('Step 3: Program Creation (5,000 Pieces Target) & Lifecycle Approval', async () => {
    const programPayload = {
      programNumber,
      programDate: '2026-10-01',
      buyerName: 'H&M Global Sourcing',
      orderNumber: `PO-HM-${suffix}`,
      designName: 'Classic Fit Cotton Polo',
      styleCode: `HM-POLO-${suffix}`,
      productCategory: 'Knitted Polo',
      targetQuantity: 5000,
      deliveryDate: '2026-12-15',
      priority: PriorityLevel.HIGH,
      remarks: '5000 Units Order with Rib Collar and 2-button placket',
      fabrics: [
        {
          fabricCode: 'FAB-SNG-01',
          fabricName: 'Single Jersey 100% Combed Cotton',
          composition: '100% Cotton',
          widthInInches: 60,
          gsm: 180,
          colour: 'Navy Blue',
          requiredQuantity: 2500,
          tolerancePercentage: 5,
          wastagePercentage: 3,
        },
      ],
      measurements: [
        { size: 'M', length: 72, chest: 54, waist: 52, shoulder: 46, sleeveLength: 23, armhole: 25, neck: 41, bottom: 53 },
        { size: 'L', length: 74, chest: 56, waist: 54, shoulder: 48, sleeveLength: 24, armhole: 26, neck: 42, bottom: 55 },
      ],
      sizeMatrix: [
        { size: 'M', targetQuantity: 2500 },
        { size: 'L', targetQuantity: 2500 },
      ],
      colorMatrix: [
        { colorCode: 'NAVY', colorName: 'Navy Blue', targetQuantity: 5000 },
      ],
      bomItems: [
        {
          itemCode: 'THRD-01',
          itemName: 'Sewing Thread 40/2',
          category: 'THREAD',
          requiredQuantityPerPiece: 85,
          uom: 'MTR',
          wastagePercentage: 2,
          totalRequiredQuantity: 433500,
        },
        {
          itemCode: 'BTN-01',
          itemName: 'Pearl Button 18L',
          category: 'BUTTON',
          requiredQuantityPerPiece: 2,
          uom: 'PCS',
          wastagePercentage: 1,
          totalRequiredQuantity: 10100,
        },
      ],
      routeSteps: [
        { sequenceOrder: 1, departmentCode: 'STORE', expectedDurationMinutes: 30, isMandatory: true, requiresQCGate: false, inputType: 'FABRIC_ROLL', outputType: 'FABRIC_ROLL', reworkAllowed: false, skipAllowed: false, isParallel: false },
        { sequenceOrder: 2, departmentCode: 'DYEING', expectedDurationMinutes: 180, isMandatory: true, requiresQCGate: true, inputType: 'FABRIC_ROLL', outputType: 'FABRIC_ROLL', reworkAllowed: true, skipAllowed: false, isParallel: false },
        { sequenceOrder: 3, departmentCode: 'CUTTING', expectedDurationMinutes: 120, isMandatory: true, requiresQCGate: true, inputType: 'FABRIC_ROLL', outputType: 'CUT_PANEL', reworkAllowed: true, skipAllowed: false, isParallel: false },
        { sequenceOrder: 4, departmentCode: 'STITCHING', expectedDurationMinutes: 240, isMandatory: true, requiresQCGate: true, inputType: 'CUT_PANEL', outputType: 'PIECE', reworkAllowed: true, skipAllowed: false, isParallel: false },
        { sequenceOrder: 5, departmentCode: 'PACKING', expectedDurationMinutes: 90, isMandatory: true, requiresQCGate: true, inputType: 'PIECE', outputType: 'CARTON', reworkAllowed: true, skipAllowed: false, isParallel: false },
        { sequenceOrder: 6, departmentCode: 'DISPATCH', expectedDurationMinutes: 60, isMandatory: true, requiresQCGate: false, inputType: 'CARTON', outputType: 'CARTON', reworkAllowed: false, skipAllowed: false, isParallel: false },
      ],
    };

    const program = await programsService.create(programPayload as any, adminUser.id);
    expect(program.programNumber).toBe(programNumber);
    expect(program.status).toBe(ProgramStatus.DRAFT);
    programId = program.id;

    // Transition State Machine: DRAFT -> SUBMITTED -> APPROVED
    await programsService.updateStatus(programId, ProgramStatus.SUBMITTED, adminUser.id);
    const approved = await programsService.updateStatus(programId, ProgramStatus.APPROVED, adminUser.id);
    expect(approved.status).toBe(ProgramStatus.APPROVED);
    expect(approved.approvedById).toBe(adminUser.id);
  });

  it('Step 4: Store to Dyeing Challan & Roll Issue with Ledger Consumption', async () => {
    // 1. Create Fabric Issue Challan from STORE to DYEING
    const challan = await challansService.create(
      {
        challanNumber: `CH-STR-${suffix}-01`,
        challanType: ChallanType.FABRIC_ISSUE,
        programId,
        fromDepartment: DepartmentCode.STORE,
        toDepartment: DepartmentCode.DYEING,
        priority: PriorityLevel.NORMAL,
        items: [
          {
            itemDescription: 'Cotton Jersey Fabric Roll',
            fabricCode: 'FAB-SNG-01',
            colour: 'Navy Blue',
            unitType: ProductionUnitType.ROLL,
            rollNumber: rollNumber1,
            quantity: 1250,
            grossWeightKg: 250,
            netWeightKg: 245,
            uom: 'MTR',
          },
        ],
      },
      adminUser.id,
    );
    expect(challan.status).toBe(ChallanStatus.DRAFT);
    storeChallanId = challan.id;

    // 2. Issue fabric roll via Inventory Engine
    await inventoryService.issueFabricRoll(
      rollNumber1,
      DepartmentCode.DYEING,
      storeChallanId,
      adminUser.id,
    );

    // 3. Advance Challan state: SUBMIT -> ISSUE -> RECEIVE -> START
    await challansService.executeAction(storeChallanId, 'SUBMIT', adminUser.id);
    await challansService.executeAction(storeChallanId, 'ISSUE', adminUser.id);
    await challansService.executeAction(storeChallanId, 'RECEIVE', adminUser.id);
    const inProcess = await challansService.executeAction(storeChallanId, 'START', adminUser.id);
    expect(inProcess.status).toBe(ChallanStatus.IN_PROCESS);
  });

  it('Step 5: Dyeing Execution & Strict Mathematical Accounting Identity', async () => {
    // Accounting Invariant: Input (1250) = Good (1200) + Rework (30) + Reject (10) + Waste (10) + Balance (0) = 1250
    const accountingValid = validateProductionBalance({
      inputQuantity: 1250,
      goodQuantity: 1200,
      reworkQuantity: 30,
      rejectQuantity: 10,
      wasteQuantity: 10,
      balanceQuantity: 0,
    });
    expect(accountingValid.isValid).toBe(true);

    const prodTx = await productionService.recordProduction(
      {
        programId,
        challanId: storeChallanId,
        departmentCode: DepartmentCode.DYEING,
        operationName: 'Soft Flow Jet Dyeing & Compacting',
        operatorId: adminUser.id,
        shift: 'SHIFT_A',
        inputQuantity: 1250,
        goodQuantity: 1200,
        reworkQuantity: 30,
        rejectQuantity: 10,
        wasteQuantity: 10,
        balanceQuantity: 0,
        unitOfMeasure: 'MTR',
        reworkReason: 'Minor shade variation at head end',
        rejectReason: 'Dye streak across edge selvage',
        wasteReason: 'Leader fabric cut loss',
      },
      adminUser.id,
    );

    expect(prodTx.goodQuantity).toBe(1200);
    expect(prodTx.reworkQuantity).toBe(30);

    // Complete the challan
    const completedChallan = await challansService.executeAction(storeChallanId, 'COMPLETE', adminUser.id);
    expect(completedChallan.status).toBe(ChallanStatus.COMPLETED);
  });

  it('Step 6: QC1 Inspection Gate with Measured Parameters & Pass Status', async () => {
    const qcResult = await qualityService.recordComprehensiveInspection(
      {
        challanId: storeChallanId,
        programId,
        departmentCode: DepartmentCode.QC1,
        sampleSize: 100,
        overallStatus: QCResultStatus.PASS,
        parameters: [
          { parameterName: 'GSM', expectedValue: '180', measuredValue: '181', tolerance: '±5', uom: 'G/M2', status: 'PASS' },
          { parameterName: 'Fabric Width', expectedValue: '60', measuredValue: '60.5', tolerance: '±1', uom: 'INCH', status: 'PASS' },
          { parameterName: 'Dimensional Shrinkage Length', expectedValue: '3.0%', measuredValue: '2.4%', tolerance: '< 4%', uom: '%', status: 'PASS' },
          { parameterName: 'Color Fastness to Washing', expectedValue: '4.0', measuredValue: '4.5', tolerance: '>= 4.0', uom: 'GREY_SCALE', status: 'PASS' },
        ],
        defects: [],
        notes: 'Dyeing output passed all dimensional stability and color fastness tests.',
      },
      adminUser.id,
    );

    expect(qcResult.status).toBe(QCResultStatus.PASS);
    expect(qcResult.parameters.length).toBe(4);

    // Check that Challan status was automatically promoted to QC_APPROVED
    const updatedChallan = await challansService.findOne(storeChallanId);
    expect(updatedChallan.status).toBe(ChallanStatus.QC_APPROVED);
  });

  it('Step 7: Dyeing to Cutting Handoff (Genealogy Parent/Child Link)', async () => {
    // Create Next-stage Challan with Parent Link to storeChallanId
    const cuttingChallan = await challansService.create(
      {
        challanNumber: `CH-DYE-${suffix}-02`,
        challanType: ChallanType.INTER_DEPARTMENT,
        programId,
        parentChallanId: storeChallanId, // Parent genealogy link
        fromDepartment: DepartmentCode.DYEING,
        toDepartment: DepartmentCode.CUTTING,
        priority: PriorityLevel.NORMAL,
        items: [
          {
            itemDescription: 'Dyed & Compacted Knit Fabric',
            fabricCode: 'FAB-SNG-01',
            colour: 'Navy Blue',
            unitType: ProductionUnitType.ROLL,
            rollNumber: rollNumber1,
            quantity: 1200,
            uom: 'MTR',
          },
        ],
      },
      adminUser.id,
    );

    expect(cuttingChallan.parentChallanId).toBe(storeChallanId);
    cuttingChallanId = cuttingChallan.id;

    // Advance Challan
    await challansService.executeAction(cuttingChallanId, 'SUBMIT', adminUser.id);
    await challansService.executeAction(cuttingChallanId, 'ISSUE', adminUser.id);
    await challansService.executeAction(cuttingChallanId, 'RECEIVE', adminUser.id);
    await challansService.executeAction(cuttingChallanId, 'START', adminUser.id);
  });

  it('Step 8: Cutting Lay Execution & 5,000 Pieces Bundle Generation', async () => {
    // Generate 5 Bundles of 1000 pieces each (Total = 5000 pieces)
    const bundlePayloads = [
      { bundleNumber: `BND-${suffix}-01`, programId, challanId: cuttingChallanId, rollNumber: rollNumber1, layNumber: 'LAY-1', patternNumber: 'PAT-HM-01', size: 'M', colour: 'Navy Blue', quantity: 1000 },
      { bundleNumber: `BND-${suffix}-02`, programId, challanId: cuttingChallanId, rollNumber: rollNumber1, layNumber: 'LAY-1', patternNumber: 'PAT-HM-01', size: 'M', colour: 'Navy Blue', quantity: 1000 },
      { bundleNumber: `BND-${suffix}-03`, programId, challanId: cuttingChallanId, rollNumber: rollNumber1, layNumber: 'LAY-2', patternNumber: 'PAT-HM-01', size: 'L', colour: 'Navy Blue', quantity: 1000 },
      { bundleNumber: `BND-${suffix}-04`, programId, challanId: cuttingChallanId, rollNumber: rollNumber1, layNumber: 'LAY-2', patternNumber: 'PAT-HM-01', size: 'L', colour: 'Navy Blue', quantity: 1000 },
      { bundleNumber: `BND-${suffix}-05`, programId, challanId: cuttingChallanId, rollNumber: rollNumber1, layNumber: 'LAY-2', patternNumber: 'PAT-HM-01', size: 'L', colour: 'Navy Blue', quantity: 1000 },
    ];

    const bundles = await bundlesService.createBundles(bundlePayloads as any, adminUser.id);
    expect(bundles.length).toBe(5);
    bundleIds = bundles.map((b) => b.id);
    expect(bundles[0].barcode).toBe(`BC-BND-${suffix}-01`);

    // Verify bundle quantities sum to 5000
    const totalBundleQty = bundles.reduce((sum, b) => sum + b.quantity, 0);
    expect(totalBundleQty).toBe(5000);
  });

  it('Step 9: Defect Logging, Rework Transaction & Re-cut Exception Workflow', async () => {
    // 1. Defect detected on Bundle 2 (50 pieces with notch misalignment)
    const defect = await defectsService.createDefect(
      {
        defectCode: 'DEF-CUT-01',
        programId,
        departmentCode: DepartmentCode.CUTTING,
        bundleId: bundleIds[1],
        itemDescription: 'Notch placement shift on front body panel',
        severity: 'MAJOR',
        quantity: 50,
        reason: 'Knife vibration caused 5mm notch drift on bottom ply',
      },
      adminUser.id,
    );
    expect(defect.status).toBe(DefectStatus.OPEN);

    // 2. Perform Real Rework Transaction (40 Good recovered, 10 Scrapped)
    const rework = await defectsService.createReworkTransaction(
      {
        defectId: defect.id,
        programId,
        departmentCode: DepartmentCode.CUTTING,
        operationName: 'Manual Panel Re-trimming & Notch Realignment',
        operatorId: adminUser.id,
        inputQuantity: 50,
        outputGoodQuantity: 40,
        outputRejectQuantity: 10,
        notes: '40 panels successfully re-notched within tolerance; 10 panels irreparable and scrapped.',
      },
      adminUser.id,
    );
    expect(rework.outputGoodQuantity).toBe(40);
    expect(rework.outputRejectQuantity).toBe(10);

    // 3. Exception Workflow: Issue Re-cut Request for the 10 scrapped panels
    const recut = await defectsService.createRecutRequest(
      {
        recutNumber: `REC-${suffix}-01`,
        programId,
        defectId: defect.id,
        originalBundleId: bundleIds[1],
        size: 'M',
        colour: 'Navy Blue',
        requestedQuantity: 10,
        reason: 'Replacement for 10 scrapped panels from Lay 1',
      },
      adminUser.id,
    );
    expect(recut.status).toBe('REQUESTED');

    // 4. Authorize Re-cut: automatically spawns Replacement Bundle
    const approvedRecut = await defectsService.approveRecutRequest(recut.id, adminUser.id);
    expect(approvedRecut.status).toBe('COMPLETED');
    expect(approvedRecut.replacementBundleId).toBeDefined();
    expect(approvedRecut.replacementBundle.quantity).toBe(10);
  });

  it('Step 10: Stitching Production Accounting & End-Line QC3', async () => {
    // Record Stitching Production (5000 pieces accounted)
    const stitchTx = await productionService.recordProduction(
      {
        programId,
        challanId: cuttingChallanId,
        departmentCode: DepartmentCode.STITCHING,
        operationName: 'Complete Body Assembly & Rib Attachment',
        operatorId: adminUser.id,
        shift: 'SHIFT_B',
        inputQuantity: 5000,
        goodQuantity: 4950,
        reworkQuantity: 30,
        rejectQuantity: 20,
        wasteQuantity: 0,
        balanceQuantity: 0,
        unitOfMeasure: 'PCS',
        reworkReason: 'Skipped stitch at bottom hem',
        rejectReason: 'Needle puncture hole through main placket',
      },
      adminUser.id,
    );

    expect(stitchTx.goodQuantity).toBe(4950);
    expect(stitchTx.goodQuantity + stitchTx.reworkQuantity + stitchTx.rejectQuantity).toBe(5000);

    // QC3 End-Line Gate Inspection
    const qc3 = await qualityService.recordComprehensiveInspection(
      {
        challanId: cuttingChallanId,
        programId,
        departmentCode: DepartmentCode.QC3,
        sampleSize: 200,
        overallStatus: QCResultStatus.PASS,
        parameters: [
          { parameterName: 'Chest Measurement M', expectedValue: '54', measuredValue: '54.2', tolerance: '±0.5', uom: 'CM', status: 'PASS' },
          { parameterName: 'Stitch Density (SPI)', expectedValue: '12', measuredValue: '12', tolerance: '±1', uom: 'SPI', status: 'PASS' },
          { parameterName: 'Placket Button Alignment', expectedValue: 'Centered', measuredValue: 'Centered', status: 'PASS' },
        ],
        defects: [],
        notes: 'Endline stitching quality passed AQL 1.5 standard.',
      },
      adminUser.id,
    );

    expect(qc3.status).toBe(QCResultStatus.PASS);
  });

  it('Step 11: Carton Packing & Inward to Finished Goods Store Ledger', async () => {
    // Pack 5000 pieces into 5 Cartons of 1000 pieces each
    const cartonPayloads = [
      { cartonNumber: `CTN-${suffix}-01`, programId, size: 'M', colour: 'Navy Blue', quantity: 1000, grossWeightKg: 210, netWeightKg: 200, locationRack: 'FG-RACK-01', locationShelf: 'SHELF-A', bundleIds: [bundleIds[0]] },
      { cartonNumber: `CTN-${suffix}-02`, programId, size: 'M', colour: 'Navy Blue', quantity: 1000, grossWeightKg: 210, netWeightKg: 200, locationRack: 'FG-RACK-01', locationShelf: 'SHELF-B', bundleIds: [bundleIds[1]] },
      { cartonNumber: `CTN-${suffix}-03`, programId, size: 'L', colour: 'Navy Blue', quantity: 1000, grossWeightKg: 220, netWeightKg: 210, locationRack: 'FG-RACK-02', locationShelf: 'SHELF-A', bundleIds: [bundleIds[2]] },
      { cartonNumber: `CTN-${suffix}-04`, programId, size: 'L', colour: 'Navy Blue', quantity: 1000, grossWeightKg: 220, netWeightKg: 210, locationRack: 'FG-RACK-02', locationShelf: 'SHELF-B', bundleIds: [bundleIds[3]] },
      { cartonNumber: `CTN-${suffix}-05`, programId, size: 'L', colour: 'Navy Blue', quantity: 1000, grossWeightKg: 220, netWeightKg: 210, locationRack: 'FG-RACK-02', locationShelf: 'SHELF-C', bundleIds: [bundleIds[4]] },
    ];

    cartonIds = [];
    for (const cData of cartonPayloads) {
      const carton = await packingService.packCarton(cData, adminUser.id);
      expect(carton.status).toBe(CartonStatus.IN_FG_STORE);
      cartonIds.push(carton.id);
    }

    expect(cartonIds.length).toBe(5);

    // Verify Finished Goods Stock Ledger entries created
    const fgLedger = await inventoryService.getLedgerEntries({
      departmentCode: DepartmentCode.FINISHED_GOODS,
      programId,
    });
    expect(fgLedger.length).toBe(5);
    const totalFgQuantity = fgLedger.reduce((sum, entry) => sum + entry.quantity, 0);
    expect(totalFgQuantity).toBe(5000);
  });

  it('Step 12: Dispatch Order Execution, FG Consumption & Double-Dispatch Prevention', async () => {
    // 1. Create and Execute Dispatch Order consuming all 5 cartons
    const dispatch = await dispatchService.createDispatchOrder(
      {
        dispatchNumber: `DSP-${suffix}-01`,
        orderNumber: `PO-HM-${suffix}`,
        invoiceNumber: `INV-2026-${suffix}`,
        transporterName: 'VRL Logistics Express',
        vehicleNumber: 'KA-01-EF-9090',
        lrNumber: `LR-VRL-${suffix}`,
        destination: 'H&M Distribution Center, Bhiwandi, Maharashtra',
        cartonIds,
        notes: 'Full order dispatch of 5000 pcs in 5 cartons under invoice',
      },
      adminUser.id,
    );

    expect(dispatch.status).toBe(DispatchStatus.DISPATCHED);
    expect(dispatch.totalQuantity).toBe(5000);
    expect(dispatch.totalCartons).toBe(5);

    // 2. Verify all cartons are marked DISPATCHED
    for (const cId of cartonIds) {
      const c = await packingService.getCarton(cId);
      expect(c.status).toBe(CartonStatus.DISPATCHED);
    }

    // 3. Verify Finished Goods Stock Ledger entries show CONSUMPTION of 5000 pieces
    const consumptionEntries = await inventoryService.getLedgerEntries({
      departmentCode: DepartmentCode.FINISHED_GOODS,
      programId,
    });
    const netFgStock = consumptionEntries.reduce((sum, entry) => sum + entry.quantity, 0);
    expect(netFgStock).toBe(0); // 5000 receipt - 5000 consumption = 0 balance

    // 4. Strict Concurrency Check: Attempting to re-dispatch any carton must be rejected
    await expect(
      dispatchService.createDispatchOrder(
        {
          dispatchNumber: `DSP-${suffix}-02`,
          orderNumber: `PO-HM-${suffix}`,
          transporterName: 'Duplicate Carrier',
          vehicleNumber: 'DL-01-XY-1234',
          destination: 'Unauthorized Outlet',
          cartonIds: [cartonIds[0]], // Already dispatched!
        },
        adminUser.id,
      ),
    ).rejects.toThrow('already been dispatched');
  });

  it('Step 13: Full Genealogy & Traceability Hierarchy Verification', async () => {
    // 1. Challan Genealogy (Cutting challan should point to Store challan as ancestor)
    const genealogy = await challansService.getGenealogy(cuttingChallanId);
    expect(genealogy.currentChallan.id).toBe(cuttingChallanId);
    expect(genealogy.ancestors.length).toBeGreaterThan(0);
    expect(genealogy.ancestors[0].id).toBe(storeChallanId);

    // 2. Program Details (Has rolls, bundles, cartons, defects, challans)
    const fullProgram = await programsService.findOne(programId);
    expect(fullProgram.programNumber).toBe(programNumber);
    expect(fullProgram.challans.length).toBeGreaterThanOrEqual(2);
  });

  it('Step 14: Real-Time Floor Board State & Mathematical Factory Reconciliation', async () => {
    const floorState = await floorBoardService.getFloorBoardState();

    expect(floorState).toBeDefined();
    expect(floorState.timestamp).toBeDefined();
    expect(floorState.accounting.isStrictlyReconciled).toBe(true);
    expect(floorState.accounting.unaccountedTotal).toBe(0);
  });
});
