import { Module } from '@nestjs/common';
import { FloorBoardService } from './floorboard.service';
import { FloorBoardController } from './floorboard.controller';
import { FloorBoardGateway } from './floorboard.gateway';

@Module({
  controllers: [FloorBoardController],
  providers: [FloorBoardService, FloorBoardGateway],
  exports: [FloorBoardService, FloorBoardGateway],
})
export class FloorBoardModule {}
