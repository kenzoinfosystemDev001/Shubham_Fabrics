import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PackingService } from './packing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateCartonSchema } from '@subham/validation';

@Controller('packing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PackingController {
  constructor(private readonly packingService: PackingService) {}

  @Get('cartons')
  @RequirePermission('PRODUCTION', 'PACKING', 'READ')
  getCartons(
    @Query('programId') programId?: string,
    @Query('status') status?: string,
    @Query('size') size?: string,
    @Query('colour') colour?: string,
    @Query('search') search?: string,
  ) {
    return this.packingService.getCartons({
      programId,
      status,
      size,
      colour,
      search,
    });
  }

  @Get('cartons/:id')
  @RequirePermission('PRODUCTION', 'PACKING', 'READ')
  getCarton(@Param('id') id: string) {
    return this.packingService.getCarton(id);
  }

  @Post('cartons')
  @RequirePermission('PRODUCTION', 'PACKING', 'CREATE')
  packCarton(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateCartonSchema.parse(body);
    return this.packingService.packCarton(validated, actorId);
  }
}
