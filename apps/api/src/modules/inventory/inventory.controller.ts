import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CreateStockLedgerEntrySchema, RegisterFabricRollSchema } from '@subham/validation';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('ledger')
  @RequirePermission('INVENTORY', 'STOCK_LEDGER', 'READ')
  getLedger(
    @Query('departmentCode') departmentCode?: string,
    @Query('itemCode') itemCode?: string,
    @Query('programId') programId?: string,
    @Query('rollNumber') rollNumber?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getLedgerEntries({
      departmentCode,
      itemCode,
      programId,
      rollNumber,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Post('ledger')
  @RequirePermission('INVENTORY', 'STOCK_LEDGER', 'CREATE')
  recordLedgerEntry(@Body() body: any, @Request() req: any) {
    const validated = CreateStockLedgerEntrySchema.parse(body);
    return this.inventoryService.recordLedgerEntry(validated, req.user.id);
  }

  @Get('summary')
  @RequirePermission('INVENTORY', 'STOCK', 'READ')
  getStockSummary(@Query('departmentCode') departmentCode?: string) {
    return this.inventoryService.getStockSummary(departmentCode);
  }

  @Get('rolls')
  @RequirePermission('INVENTORY', 'FABRIC_ROLL', 'READ')
  getFabricRolls(@Query('programId') programId?: string, @Query('status') status?: string) {
    return this.inventoryService.getFabricRolls({ programId, status });
  }

  @Post('rolls')
  @RequirePermission('INVENTORY', 'FABRIC_ROLL', 'CREATE')
  registerFabricRoll(@Body() body: any, @Request() req: any) {
    const validated = RegisterFabricRollSchema.parse(body);
    return this.inventoryService.registerFabricRoll(validated, req.user.id);
  }

  @Post('rolls/issue')
  @RequirePermission('INVENTORY', 'FABRIC_ROLL', 'ISSUE')
  issueFabricRoll(@Body() body: { rollNumber: string; targetDepartment: any; challanId: string }, @Request() req: any) {
    return this.inventoryService.issueFabricRoll(
      body.rollNumber,
      body.targetDepartment,
      body.challanId,
      req.user.id,
    );
  }
}
