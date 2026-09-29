import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DefectsService } from './defects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateDefectRecordSchema,
  CreateReworkTransactionSchema,
  CreateRecutRequestSchema,
} from '@subham/validation';

@Controller('defects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DefectsController {
  constructor(private readonly defectsService: DefectsService) {}

  @Get()
  @RequirePermission('QUALITY', 'DEFECT', 'READ')
  getDefects(
    @Query('programId') programId?: string,
    @Query('departmentCode') departmentCode?: string,
    @Query('status') status?: string,
  ) {
    return this.defectsService.getDefects({ programId, departmentCode, status });
  }

  @Post()
  @RequirePermission('QUALITY', 'DEFECT', 'CREATE')
  createDefect(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateDefectRecordSchema.parse(body);
    return this.defectsService.createDefect(validated, actorId);
  }

  @Patch(':id/status')
  @RequirePermission('QUALITY', 'DEFECT', 'UPDATE')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: any,
    @Body('resolutionNotes') resolutionNotes: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.defectsService.updateDefectStatus(id, status, resolutionNotes, actorId);
  }

  @Get('reworks')
  @RequirePermission('QUALITY', 'REWORK', 'READ')
  getReworks(
    @Query('programId') programId?: string,
    @Query('departmentCode') departmentCode?: string,
  ) {
    return this.defectsService.getReworks({ programId, departmentCode });
  }

  @Post('reworks')
  @RequirePermission('QUALITY', 'REWORK', 'CREATE')
  createRework(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateReworkTransactionSchema.parse(body);
    return this.defectsService.createReworkTransaction(validated, actorId);
  }

  @Get('recuts')
  @RequirePermission('PRODUCTION', 'RECUT', 'READ')
  getRecuts(@Query('programId') programId?: string, @Query('status') status?: string) {
    return this.defectsService.getRecutRequests({ programId, status });
  }

  @Post('recuts')
  @RequirePermission('PRODUCTION', 'RECUT', 'CREATE')
  createRecut(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateRecutRequestSchema.parse(body);
    return this.defectsService.createRecutRequest(validated, actorId);
  }

  @Post('recuts/:id/approve')
  @RequirePermission('PRODUCTION', 'RECUT', 'APPROVE')
  approveRecut(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.defectsService.approveRecutRequest(id, actorId);
  }
}
