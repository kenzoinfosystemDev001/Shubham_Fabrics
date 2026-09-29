import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { CreateProgramSchema } from '@subham/validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, ProgramStatus } from '@subham/types';

@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  async getPrograms(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.programsService.findAll({ status, search });
  }

  @Get(':id')
  async getProgram(@Param('id') id: string) {
    return this.programsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PRODUCTION_MANAGER)
  async createProgram(
    @Body() body: any,
    @CurrentUser('id') actorId: string,
  ) {
    const validated = CreateProgramSchema.parse(body);
    return this.programsService.create(validated, actorId);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PRODUCTION_MANAGER)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ProgramStatus,
    @CurrentUser('id') actorId: string,
  ) {
    return this.programsService.updateStatus(id, status, actorId);
  }
}
