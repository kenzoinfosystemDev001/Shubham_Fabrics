import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { DiagnosticsService } from './diagnostics.service';

@Controller('diagnostics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Post('integrity-check')
  async runIntegrityCheck() {
    return this.diagnosticsService.runIntegrityCheck();
  }

  @Get('integrity-history')
  async getScanHistory() {
    return this.diagnosticsService.getScanHistory();
  }
}
