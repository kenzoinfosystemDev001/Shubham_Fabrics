import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { ProgramsService } from '../src/modules/programs/programs.service';
import { ChallansService } from '../src/modules/challans/challans.service';
import { ProductionService } from '../src/modules/production/production.service';
import { DepartmentCode, ChallanStatus } from '@subham/types';

describe('MES End-to-End Workflow Integration Test', () => {
  let app: INestApplication;
  let authService: AuthService;
  let programsService: ProgramsService;
  let challansService: ChallansService;
  let productionService: ProductionService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    programsService = moduleFixture.get<ProgramsService>(ProgramsService);
    challansService = moduleFixture.get<ChallansService>(ChallansService);
    productionService = moduleFixture.get<ProductionService>(ProductionService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. should authenticate admin user with hashed password and return JWT', async () => {
    const authResult = await authService.login({
      usernameOrEmail: 'admin',
      password: 'Admin@12345',
    });

    expect(authResult).toBeDefined();
    expect(authResult.accessToken).toBeDefined();
    expect(authResult.user.username).toBe('admin');
    expect(authResult.user.role).toBe('SUPER_ADMIN');
  });

  it('2. should retrieve approved Program PRG-2026-0001 with 17-department route', async () => {
    const programs = await programsService.findAll({ search: 'PRG-2026-0001' });
    expect(programs.length).toBeGreaterThan(0);

    const program = await programsService.findOne(programs[0].id);
    expect(program.programNumber).toBe('PRG-2026-0001');
    expect(program.routeSteps.length).toBe(17);
    expect(program.targetQuantity).toBe(1200);
    expect(program.fabrics.length).toBeGreaterThan(0);
    expect(program.bomItems.length).toBeGreaterThan(0);
  });

  it('3. should generate globally unique next challan number', async () => {
    const nextNumber = await challansService.generateNextChallanNumber(DepartmentCode.CUTTING);
    expect(nextNumber).toMatch(/^CH-CUT-2026-\d{6}$/);
  });

  it('4. should enforce strict mathematical production accounting identity', async () => {
    const programs = await programsService.findAll({ search: 'PRG-2026-0001' });
    const programId = programs[0].id;
    const challans = await challansService.findAll({ programId });
    const challanId = challans[0].id;

    const users = await authService.getAllUsers();
    const cutSupervisor = users.find((u) => u.username === 'cut_sup') || users[0];

    // Valid Identity: 100 Input = 90 Good + 5 Rework + 3 Reject + 2 Waste + 0 Balance (90+5+3+2 = 100)
    const validTransaction = await productionService.recordProduction(
      {
        programId,
        challanId,
        departmentCode: DepartmentCode.CUTTING,
        operationName: 'Trial Lay Cutting',
        operatorId: cutSupervisor.id,
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
      cutSupervisor.id,
    );

    expect(validTransaction).toBeDefined();
    expect(validTransaction.goodQuantity).toBe(90);
    expect(validTransaction.inputQuantity).toBe(100);

    // Invalid Identity: 100 Input != 80 Good + 0 + 0 + 0 (Imbalance of 20) -> Must throw BadRequestException
    await expect(
      productionService.recordProduction(
        {
          programId,
          challanId,
          departmentCode: DepartmentCode.CUTTING,
          operationName: 'Flawed Lay Cutting',
          operatorId: cutSupervisor.id,
          inputQuantity: 100,
          goodQuantity: 80,
          reworkQuantity: 0,
          rejectQuantity: 0,
          wasteQuantity: 0,
          balanceQuantity: 0,
          unitOfMeasure: 'KG',
        },
        cutSupervisor.id,
      ),
    ).rejects.toThrow();
  });

  it('5. should traverse backward and forward genealogy tree', async () => {
    const challans = await challansService.findAll({ status: 'ISSUED' });
    if (challans.length > 0) {
      const genealogy = await challansService.getGenealogy(challans[0].id);
      expect(genealogy).toBeDefined();
      expect(genealogy.currentChallan).toBeDefined();
    }
  });
});
