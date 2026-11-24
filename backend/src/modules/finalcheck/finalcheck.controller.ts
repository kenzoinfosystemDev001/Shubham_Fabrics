import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { FinalCheckService } from './finalcheck.service';

@Controller('final-check')
export class FinalCheckController {
  constructor(private readonly service: FinalCheckService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.service.getDashboardSummary();
  }

  @Get('incoming')
  async getIncoming() {
    return this.service.getIncomingChallans();
  }

  @Get('queue')
  async getQueue() {
    return this.service.getQueue();
  }

  @Get('jobs/:id')
  async getJobById(@Param('id') id: string) {
    return this.service.getJobById(id);
  }

  @Post('challans/:id/receive')
  async receiveChallan(@Param('id') id: string, @Body() body: any) {
    return this.service.receiveChallan(id, body || {});
  }

  @Post('jobs/:id/inspect')
  async inspectJob(@Param('id') id: string, @Body() body: any) {
    return this.service.inspectJob(id, body || {});
  }

  @Post('jobs/:id/hold')
  async holdJob(@Param('id') id: string, @Body() body: any) {
    return this.service.holdJob(id, body || {});
  }

  @Post('issue-challan')
  async issueChallan(@Body() body: any) {
    return this.service.issueChallan(body);
  }

  @Get('floor-board')
  async getFloorBoard() {
    return this.service.getFloorBoard();
  }

  @Get('reports')
  async getReports(@Query('days') days?: string) {
    return this.service.getReports(days ? Number(days) : 30);
  }
}
