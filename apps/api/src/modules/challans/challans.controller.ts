import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { z, ZodTypeAny } from 'zod';
import { ChallansService } from './challans.service';
import { CreateChallanSchema, ChallanActionSchema, ChallanStatusUpdateSchema } from '@subham/validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DepartmentCode, UserSession } from '@subham/types';

function parseOrBadRequest<S extends ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  return result.data;
}

@Controller('challans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChallansController {
  constructor(private readonly challansService: ChallansService) {}

  @Get('next-number')
  async getNextNumber(@Query('department') department: DepartmentCode) {
    const code = department || DepartmentCode.STORE;
    const nextNumber = await this.challansService.generateNextChallanNumber(code);
    return { nextNumber };
  }

  @Get()
  async getChallans(
    @Query('fromDepartment') fromDepartment?: string,
    @Query('toDepartment') toDepartment?: string,
    @Query('department') department?: string,
    @Query('status') status?: string,
    @Query('programId') programId?: string,
  ) {
    return this.challansService.findAll({
      fromDepartment,
      toDepartment,
      department,
      status,
      programId,
    });
  }

  @Get(':id')
  async getChallan(@Param('id') id: string) {
    return this.challansService.findOne(id);
  }

  @Get(':id/genealogy')
  async getGenealogy(@Param('id') id: string) {
    return this.challansService.getGenealogy(id);
  }

  @Post()
  async createChallan(@Body() body: unknown, @CurrentUser() actor: UserSession) {
    const validated = parseOrBadRequest(CreateChallanSchema, body);
    return this.challansService.create(validated, actor);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() actor: UserSession,
  ) {
    const { status, notes } = parseOrBadRequest(ChallanStatusUpdateSchema, body);
    return this.challansService.transitionStatus(id, status, actor, notes);
  }

  @Post(':id/action')
  async executeAction(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() actor: UserSession,
  ) {
    const parsed = parseOrBadRequest(ChallanActionSchema, body);
    return this.challansService.executeAction(id, parsed.action, actor, {
      reason: parsed.reason,
      notes: parsed.notes,
      metadata: parsed.metadata,
    });
  }
}
