import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { BundlesService } from './bundles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateBundleSchema } from '@subham/validation';
import { z } from 'zod';

@Controller('bundles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  @Get()
  @RequirePermission('PRODUCTION', 'BUNDLE', 'READ')
  getBundles(
    @Query('programId') programId?: string,
    @Query('currentDepartment') currentDepartment?: string,
    @Query('status') status?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
  ) {
    return this.bundlesService.findAll({
      programId,
      currentDepartment,
      status,
      size,
      search,
    });
  }

  @Get(':id')
  @RequirePermission('PRODUCTION', 'BUNDLE', 'READ')
  getBundle(@Param('id') id: string) {
    return this.bundlesService.findOne(id);
  }

  @Post()
  @RequirePermission('PRODUCTION', 'BUNDLE', 'CREATE')
  createBundles(@Body() body: any, @CurrentUser('id') actorId: string) {
    const listSchema = z.array(CreateBundleSchema).or(CreateBundleSchema.transform((item) => [item]));
    const validated = listSchema.parse(body);
    return this.bundlesService.createBundles(validated, actorId);
  }

  @Patch(':id/transfer')
  @RequirePermission('PRODUCTION', 'BUNDLE', 'UPDATE')
  updateDepartment(
    @Param('id') id: string,
    @Body('departmentCode') departmentCode: any,
    @Body('status') status: any,
    @CurrentUser('id') actorId: string,
  ) {
    return this.bundlesService.updateDepartment(id, departmentCode, status, actorId);
  }
}
