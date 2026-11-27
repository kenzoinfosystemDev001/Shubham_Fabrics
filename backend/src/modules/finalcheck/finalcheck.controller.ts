import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinalCheckService } from './finalcheck.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DepartmentsGuard } from '../../common/guards/departments.guard';
import { Departments } from '../../common/decorators/departments.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Department codes for Final QC: the same aliases the frontend uses (DEPARTMENT_ACCESS.FINAL_CHECK).
 * Administrators also pass (DepartmentsGuard).
 */
export const FINAL_CHECK_DEPARTMENTS = ['FINAL_CHECK', 'FINAL CHECK', 'FINAL_QC', 'FINAL-CHECK'];

/** The authenticated caller, as loaded from the database by JwtStrategy. */
export interface Actor {
  id: string;
  departmentCode?: string | null;
}

/**
 * Every Final Check endpoint requires a valid session (JwtAuthGuard: 401 otherwise) and a Final
 * Check or administrator department on the database user record (DepartmentsGuard: 403 otherwise).
 * Write endpoints record the caller as the actor; no actor is taken from the request body.
 */
@Controller('final-check')
@UseGuards(JwtAuthGuard, DepartmentsGuard)
@Departments(...FINAL_CHECK_DEPARTMENTS)
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
  async receiveChallan(@Param('id') id: string, @Body() body: any, @CurrentUser() actor: Actor) {
    return this.service.receiveChallan(id, body || {}, actor);
  }

  @Post('jobs/:id/inspect')
  async inspectJob(@Param('id') id: string, @Body() body: any, @CurrentUser() actor: Actor) {
    return this.service.inspectJob(id, body || {}, actor);
  }

  @Post('jobs/:id/hold')
  async holdJob(@Param('id') id: string, @Body() body: any, @CurrentUser() actor: Actor) {
    return this.service.holdJob(id, body || {}, actor);
  }

  @Post('issue-challan')
  async issueChallan(@Body() body: any, @CurrentUser() actor: Actor) {
    return this.service.issueChallan(body, actor);
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
