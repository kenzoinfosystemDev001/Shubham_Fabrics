import { Module } from '@nestjs/common';
import { FinalCheckController } from './finalcheck.controller';
import { FinalCheckService } from './finalcheck.service';

@Module({
  controllers: [FinalCheckController],
  providers: [FinalCheckService],
  exports: [FinalCheckService],
})
export class FinalCheckModule {}
