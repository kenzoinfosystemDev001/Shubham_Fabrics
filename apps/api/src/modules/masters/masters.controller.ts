import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MastersService } from './masters.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CreateFabricMasterSchema,
  CreateTrimSchema,
  CreateDesignSchema,
  CreateColourSchema,
  CreateSizeSchema,
  CreateDepartmentSchema,
  CreateWorkCenterSchema,
  CreateMachineSchema,
  CreateOperationSchema,
  CreateDefectCodeSchema,
  AssignUserRoleSchema,
} from '@subham/validation';

@Controller('masters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  // 1. Suppliers
  @Get('suppliers')
  @RequirePermission('MASTER_DATA', 'SUPPLIER', 'READ')
  async getSuppliers(@Query('search') search?: string, @Query('isActive') isActive?: string) {
    return this.mastersService.getSuppliers({
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post('suppliers')
  @RequirePermission('MASTER_DATA', 'SUPPLIER', 'CREATE')
  async createSupplier(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateSupplierSchema.parse(body);
    return this.mastersService.createSupplier(validated, actorId);
  }

  @Put('suppliers/:id')
  @RequirePermission('MASTER_DATA', 'SUPPLIER', 'UPDATE')
  async updateSupplier(@Param('id') id: string, @Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = UpdateSupplierSchema.parse(body);
    return this.mastersService.updateSupplier(id, validated, actorId);
  }

  // 2. Customers
  @Get('customers')
  @RequirePermission('MASTER_DATA', 'CUSTOMER', 'READ')
  async getCustomers(@Query('search') search?: string, @Query('isActive') isActive?: string) {
    return this.mastersService.getCustomers({
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Post('customers')
  @RequirePermission('MASTER_DATA', 'CUSTOMER', 'CREATE')
  async createCustomer(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateCustomerSchema.parse(body);
    return this.mastersService.createCustomer(validated, actorId);
  }

  @Put('customers/:id')
  @RequirePermission('MASTER_DATA', 'CUSTOMER', 'UPDATE')
  async updateCustomer(@Param('id') id: string, @Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = UpdateCustomerSchema.parse(body);
    return this.mastersService.updateCustomer(id, validated, actorId);
  }

  // 3. Fabrics
  @Get('fabrics')
  @RequirePermission('MASTER_DATA', 'FABRIC', 'READ')
  async getFabrics(@Query('search') search?: string) {
    return this.mastersService.getFabrics({ search });
  }

  @Post('fabrics')
  @RequirePermission('MASTER_DATA', 'FABRIC', 'CREATE')
  async createFabric(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateFabricMasterSchema.parse(body);
    return this.mastersService.createFabric(validated, actorId);
  }

  // 4. Trims
  @Get('trims')
  @RequirePermission('MASTER_DATA', 'TRIM', 'READ')
  async getTrims(@Query('category') category?: string, @Query('search') search?: string) {
    return this.mastersService.getTrims({ category, search });
  }

  @Post('trims')
  @RequirePermission('MASTER_DATA', 'TRIM', 'CREATE')
  async createTrim(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateTrimSchema.parse(body);
    return this.mastersService.createTrim(validated, actorId);
  }

  // 5. Designs
  @Get('designs')
  @RequirePermission('MASTER_DATA', 'DESIGN', 'READ')
  async getDesigns(@Query('search') search?: string) {
    return this.mastersService.getDesigns({ search });
  }

  @Post('designs')
  @RequirePermission('MASTER_DATA', 'DESIGN', 'CREATE')
  async createDesign(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateDesignSchema.parse(body);
    return this.mastersService.createDesign(validated, actorId);
  }

  // 6. Colours & Sizes
  @Get('colours')
  @RequirePermission('MASTER_DATA', 'COLOUR', 'READ')
  async getColours() {
    return this.mastersService.getColours();
  }

  @Post('colours')
  @RequirePermission('MASTER_DATA', 'COLOUR', 'CREATE')
  async createColour(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateColourSchema.parse(body);
    return this.mastersService.createColour(validated, actorId);
  }

  @Get('sizes')
  @RequirePermission('MASTER_DATA', 'SIZE', 'READ')
  async getSizes() {
    return this.mastersService.getSizes();
  }

  @Post('sizes')
  @RequirePermission('MASTER_DATA', 'SIZE', 'CREATE')
  async createSize(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateSizeSchema.parse(body);
    return this.mastersService.createSize(validated, actorId);
  }

  // 7. Departments, Work Centers & Machines
  @Get('departments')
  @RequirePermission('MASTER_DATA', 'DEPARTMENT', 'READ')
  async getDepartments() {
    return this.mastersService.getDepartments();
  }

  @Post('departments')
  @RequirePermission('MASTER_DATA', 'DEPARTMENT', 'UPDATE')
  async createDepartment(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateDepartmentSchema.parse(body);
    return this.mastersService.createDepartment(validated, actorId);
  }

  @Get('work-centers')
  async getWorkCenters() {
    return this.mastersService.getWorkCenters();
  }

  @Post('work-centers')
  async createWorkCenter(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateWorkCenterSchema.parse(body);
    return this.mastersService.createWorkCenter(validated, actorId);
  }

  @Get('machines')
  async getMachines() {
    return this.mastersService.getMachines();
  }

  @Post('machines')
  async createMachine(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateMachineSchema.parse(body);
    return this.mastersService.createMachine(validated, actorId);
  }

  @Get('shifts')
  async getShifts() {
    return this.mastersService.getShifts();
  }

  // 8. Operations & Defect Codes
  @Get('operations')
  async getOperations() {
    return this.mastersService.getOperations();
  }

  @Post('operations')
  async createOperation(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateOperationSchema.parse(body);
    return this.mastersService.createOperation(validated, actorId);
  }

  @Get('defect-codes')
  async getDefectCodes() {
    return this.mastersService.getDefectCodes();
  }

  @Post('defect-codes')
  async createDefectCode(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateDefectCodeSchema.parse(body);
    return this.mastersService.createDefectCode(validated, actorId);
  }

  // 9. Roles & Permissions
  @Get('roles')
  async getRoles() {
    return this.mastersService.getRoles();
  }

  @Get('permissions')
  async getPermissions() {
    return this.mastersService.getPermissions();
  }

  @Post('assign-role')
  async assignRole(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = AssignUserRoleSchema.parse(body);
    return this.mastersService.assignUserRole(validated.userId, validated.roleId, actorId);
  }
}
