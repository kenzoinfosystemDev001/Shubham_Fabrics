import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { MastersService } from '../src/modules/masters/masters.service';
import { ProgramsService } from '../src/modules/programs/programs.service';
import { ChallansService } from '../src/modules/challans/challans.service';
import { ProductionService } from '../src/modules/production/production.service';
import { DepartmentCode, PriorityLevel, ProgramStatus } from '@subham/types';

describe('MES Phase 1 End-to-End Workflow Integration Test (Neon PostgreSQL)', () => {
  jest.setTimeout(60000);
  let app: INestApplication;
  let authService: AuthService;
  let mastersService: MastersService;
  let programsService: ProgramsService;
  let challansService: ChallansService;
  let productionService: ProductionService;
  let adminUser: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    mastersService = moduleFixture.get<MastersService>(MastersService);
    programsService = moduleFixture.get<ProgramsService>(ProgramsService);
    challansService = moduleFixture.get<ChallansService>(ChallansService);
    productionService = moduleFixture.get<ProductionService>(ProductionService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. should authenticate admin user with hashed password and return roles and permissions', async () => {
    const authResult = await authService.login({
      usernameOrEmail: 'admin',
      password: 'Admin@12345',
    });

    expect(authResult).toBeDefined();
    expect(authResult.accessToken).toBeDefined();
    expect(authResult.user.username).toBe('admin');
    expect(authResult.user.role).toBe('SUPER_ADMIN');
    expect(authResult.user.permissions.length).toBeGreaterThan(0);
    adminUser = authResult.user;
  });

  it('2. should manage Master Data CRUD and prevent duplicate codes', async () => {
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    const supplierCode = `SUP-TEST-${randomSuffix}`;

    // Create Supplier
    const createdSupplier = await mastersService.createSupplier(
      {
        code: supplierCode,
        name: 'Century Textiles & Fabrics Ltd.',
        contactPerson: 'Kishore Biyani',
        email: 'kishore@century.com',
        phone: '+91 22 2495 7000',
        rating: 4.8,
      },
      adminUser.id,
    );

    expect(createdSupplier).toBeDefined();
    expect(createdSupplier.code).toBe(supplierCode);

    // Prevent duplicate supplier code
    await expect(
      mastersService.createSupplier(
        {
          code: supplierCode,
          name: 'Duplicate Entry',
        },
        adminUser.id,
      ),
    ).rejects.toThrow();

    // Read & filter supplier
    const suppliers = await mastersService.getSuppliers({ search: supplierCode });
    expect(suppliers.length).toBe(1);
    expect(suppliers[0].id).toBe(createdSupplier.id);
  });

  it('3. should create a complete Program File with BOM, measurements, sizes and configurable route', async () => {
    const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
    const programNumber = `PRG-2026-${randomSuffix}`;

    const programPayload = {
      programNumber,
      programDate: '2026-09-30',
      buyerName: 'Tommy Hilfiger International',
      orderNumber: `PO-TH-${randomSuffix}`,
      designName: 'Heritage Classic Slim Tee',
      styleCode: `TH-SLIM-${randomSuffix}`,
      productCategory: 'Knitted T-Shirt',
      targetQuantity: 500,
      deliveryDate: '2026-11-15',
      priority: PriorityLevel.NORMAL,
      remarks: 'Double-needle hem and taped neck seam',
      fabrics: [
        {
          fabricCode: 'FAB-SNG-01',
          fabricName: 'Single Jersey Super-Combed',
          composition: '100% Combed Cotton',
          widthInInches: 60,
          gsm: 180,
          colour: 'Navy Blue',
          requiredQuantity: 250,
          tolerancePercentage: 5,
          wastagePercentage: 3,
        },
      ],
      measurements: [
        { size: 'M', length: 71, chest: 53, waist: 51, shoulder: 44, sleeveLength: 22, armhole: 24.5, neck: 39.5, bottom: 52 },
      ],
      sizeMatrix: [
        { size: 'M', targetQuantity: 500 },
      ],
      colorMatrix: [
        { colorCode: 'CLR-NVY', colorName: 'Navy Blue', targetQuantity: 500 },
      ],
      bomItems: [
        {
          itemCode: 'THRD-01',
          itemName: 'Sewing Thread 40/2',
          category: 'THREAD',
          requiredQuantityPerPiece: 80,
          uom: 'MTR',
          wastagePercentage: 2,
          totalRequiredQuantity: 40800,
        },
      ],
      routeSteps: [
        { sequenceOrder: 1, departmentCode: 'STORE', expectedDurationMinutes: 30, isMandatory: true, requiresQCGate: false, inputType: 'FABRIC_ROLL', outputType: 'FABRIC_ROLL', reworkAllowed: false, skipAllowed: false, isParallel: false },
        { sequenceOrder: 2, departmentCode: 'CUTTING', expectedDurationMinutes: 60, isMandatory: true, requiresQCGate: true, inputType: 'FABRIC_ROLL', outputType: 'CUT_PANEL', reworkAllowed: true, skipAllowed: false, isParallel: false },
        { sequenceOrder: 3, departmentCode: 'STITCHING', expectedDurationMinutes: 120, isMandatory: true, requiresQCGate: true, inputType: 'CUT_PANEL', outputType: 'PIECE', reworkAllowed: true, skipAllowed: false, isParallel: false },
      ],
    };

    const createdProg = await programsService.create(programPayload as any, adminUser.id);
    expect(createdProg).toBeDefined();
    expect(createdProg.status).toBe(ProgramStatus.DRAFT);
    expect(createdProg.routes[0].steps.length).toBe(3);

    // Test Program State Machine Transition: DRAFT -> SUBMITTED -> APPROVED
    const submittedProg = await programsService.updateStatus(createdProg.id, ProgramStatus.SUBMITTED, adminUser.id);
    expect(submittedProg.status).toBe(ProgramStatus.SUBMITTED);

    const approvedProg = await programsService.updateStatus(createdProg.id, ProgramStatus.APPROVED, adminUser.id);
    expect(approvedProg.status).toBe(ProgramStatus.APPROVED);
    expect(approvedProg.approvedById).toBe(adminUser.id);

    // Illegal jump (e.g. APPROVED -> DRAFT) must throw BadRequestException
    await expect(
      programsService.updateStatus(createdProg.id, ProgramStatus.DRAFT, adminUser.id),
    ).rejects.toThrow();
  });

  it('4. should retrieve seeded Program PRG-2026-0001 with full 17-stage route from Neon DB', async () => {
    const programs = await programsService.findAll({ search: 'PRG-2026-0001' });
    expect(programs.length).toBeGreaterThan(0);

    const program = await programsService.findOne(programs[0].id);
    expect(program.programNumber).toBe('PRG-2026-0001');
    expect(program.routeSteps.length).toBeGreaterThanOrEqual(17);
    expect(program.targetQuantity).toBe(1200);
    expect(program.fabrics.length).toBeGreaterThan(0);
    expect(program.bomItems.length).toBeGreaterThan(0);
  });

  it('5. should enforce strict mathematical production accounting identity', async () => {
    const programs = await programsService.findAll({ search: 'PRG-2026-0001' });
    const programId = programs[0].id;
    const challans = await challansService.findAll({ programId });

    if (challans.length > 0) {
      const challanId = challans[0].id;
      // Valid Identity: 100 Input = 90 Good + 5 Rework + 3 Reject + 2 Waste + 0 Balance (90+5+3+2 = 100)
      const validTransaction = await productionService.recordProduction(
        {
          programId,
          challanId,
          departmentCode: DepartmentCode.CUTTING,
          operationName: 'Trial Lay Cutting',
          operatorId: adminUser.id,
          machineId: 'CUT-TABLE-01',
          shift: 'Shift-A',
          inputQuantity: 100,
          goodQuantity: 90,
          reworkQuantity: 5,
          rejectQuantity: 3,
          wasteQuantity: 2,
          balanceQuantity: 0,
          unitOfMeasure: 'KG',
          reworkReason: 'End selvage fraying',
          rejectReason: 'Yarn knot flaw',
        },
        adminUser.id,
      );

      expect(validTransaction).toBeDefined();
      expect(validTransaction.goodQuantity).toBe(90);
      expect(validTransaction.inputQuantity).toBe(100);

      // Invalid Identity: 100 Input != 80 Good (Imbalance of 20) -> Must throw
      await expect(
        productionService.recordProduction(
          {
            programId,
            challanId,
            departmentCode: DepartmentCode.CUTTING,
            operationName: 'Flawed Lay Cutting',
            operatorId: adminUser.id,
            inputQuantity: 100,
            goodQuantity: 80,
            reworkQuantity: 0,
            rejectQuantity: 0,
            wasteQuantity: 0,
            balanceQuantity: 0,
            unitOfMeasure: 'KG',
          },
          adminUser.id,
        ),
      ).rejects.toThrow();
    }
  });
});
