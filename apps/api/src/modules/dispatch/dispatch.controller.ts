import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateDispatchOrderSchema } from '@subham/validation';

@Controller('dispatch')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get()
  @RequirePermission('PRODUCTION', 'DISPATCH', 'READ')
  getDispatches(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dispatchService.getDispatchOrders({
      status,
      search,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Get(':id')
  @RequirePermission('PRODUCTION', 'DISPATCH', 'READ')
  getDispatch(@Param('id') id: string) {
    return this.dispatchService.getDispatchOrder(id);
  }

  @Post()
  @RequirePermission('PRODUCTION', 'DISPATCH', 'CREATE')
  createDispatch(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateDispatchOrderSchema.parse(body);
    return this.dispatchService.createDispatchOrder(validated, actorId);
  }
}
