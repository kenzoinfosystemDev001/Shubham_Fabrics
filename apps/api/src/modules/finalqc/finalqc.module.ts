import { Module } from '@nestjs/common';
import { FinalQCController } from './finalqc.controller';
import { FinalQCService } from './finalqc.service';

@Module({
  controllers: [FinalQCController],
  providers: [FinalQCService],
  exports: [FinalQCService],
})
export class FinalQCModule {}
