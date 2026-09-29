import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ProductionService } from './production.service';
import { RecordProductionAccountingSchema } from '@subham/validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('production')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('record')
  async recordProduction(
    @Body() body: any,
    @CurrentUser('id') actorId: string,
  ) {
    const validated = RecordProductionAccountingSchema.parse(body);
    return this.productionService.recordProduction(validated, actorId);
  }

  @Get('history')
  async getHistory(
    @Query('programId') programId?: string,
    @Query('departmentCode') departmentCode?: string,
    @Query('operatorId') operatorId?: string,
  ) {
    return this.productionService.getHistory({
      programId,
      departmentCode,
      operatorId,
    });
  }
}
