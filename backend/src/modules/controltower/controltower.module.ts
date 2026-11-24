import { Module } from '@nestjs/common';
import { ControlTowerService } from './controltower.service';
import { ControlTowerController } from './controltower.controller';

@Module({
  controllers: [ControlTowerController],
  providers: [ControlTowerService],
  exports: [ControlTowerService],
})
export class ControlTowerModule {}
