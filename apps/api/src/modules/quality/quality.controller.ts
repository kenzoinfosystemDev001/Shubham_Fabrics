import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { QualityService } from './quality.service';
import { QualityInspectionSchema } from '@subham/validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@subham/types';

@Controller('quality')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Post('inspect')
  @Roles(UserRole.SUPER_ADMIN, UserRole.QC_INSPECTOR, UserRole.PRODUCTION_MANAGER)
  async recordInspection(
    @Body() body: any,
    @CurrentUser('id') inspectorId: string,
  ) {
    const validated = QualityInspectionSchema.parse(body);
    return this.qualityService.recordInspection(validated, inspectorId);
  }

  @Get('inspections')
  async getInspections(
    @Query('challanId') challanId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.qualityService.getInspections({ challanId, programId });
  }
}
