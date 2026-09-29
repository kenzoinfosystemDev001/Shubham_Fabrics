import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ControlTowerService } from './controltower.service';

@Controller('control-tower')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ControlTowerController {
  constructor(private readonly controlTowerService: ControlTowerService) {}

  @Get('summary')
  async getSummary() {
    return this.controlTowerService.getExecutiveControlTower();
  }

  @Get('floor-board')
  async getSmartFloorBoard() {
    return this.controlTowerService.getSmartFloorBoard();
  }
}
