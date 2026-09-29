import { Controller, Get, UseGuards } from '@nestjs/common';
import { FloorBoardService } from './floorboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('floorboard')
@UseGuards(JwtAuthGuard)
export class FloorBoardController {
  constructor(private readonly floorBoardService: FloorBoardService) {}

  @Get('state')
  async getFloorBoardState() {
    return this.floorBoardService.getFloorBoardState();
  }
}
