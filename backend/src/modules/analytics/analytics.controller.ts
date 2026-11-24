import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('production')
  async getProduction() {
    return this.analyticsService.getProductionAnalytics();
  }

  @Get('quality')
  async getQuality() {
    return this.analyticsService.getQualityAnalytics();
  }

  @Get('materials')
  async getMaterials() {
    return this.analyticsService.getMaterialAnalytics();
  }

  @Get('delivery')
  async getDelivery() {
    return this.analyticsService.getDeliveryControl();
  }

  @Get('bottlenecks')
  async getBottlenecks() {
    return this.analyticsService.getBottlenecks();
  }
}
