import { Module } from '@nestjs/common';
import { ChallansService } from './challans.service';
import { ChallansController } from './challans.controller';

@Module({
  controllers: [ChallansController],
  providers: [ChallansService],
  exports: [ChallansService],
})
export class ChallansModule {}
