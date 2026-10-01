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

  @Get('next-number')
  async getNextNumber() {
    const nextNumber = await this.programsService.generateNextProgramNumber();
    return { nextNumber };
  }

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

  @Post('production-sheet')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PROGRAMMING_INCHARGE,
    UserRole.PROGRAMMER,
  )
  async createProductionSheet(
    @Body() body: any,
    @CurrentUser('id') actorId: string,
  ) {
    return this.programsService.createProductionSheet(body, actorId);
  }

  @Patch(':id/production-sheet')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PROGRAMMING_INCHARGE,
    UserRole.PROGRAMMER,
  )
  async updateProductionSheet(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser('id') actorId: string,
  ) {
    return this.programsService.updateProductionSheet(id, body, actorId);
  }

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PROGRAMMING_INCHARGE,
    UserRole.PROGRAMMER,
  )
  async createProgram(
    @Body() body: any,
    @CurrentUser('id') actorId: string,
  ) {
    // If request contains production sheet specific fields, route to production sheet creator
    if (body.wilcomDesignNumber || body.fabricWidthInches || body.programSerialNo || !body.fabrics) {
      return this.programsService.createProductionSheet(body, actorId);
    }
    const validated = CreateProgramSchema.parse(body);
    return this.programsService.create(validated, actorId);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.PRODUCTION_MANAGER,
    UserRole.PROGRAMMING_INCHARGE,
    UserRole.PROGRAMMER,
  )
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ProgramStatus,
    @CurrentUser('id') actorId: string,
  ) {
    return this.programsService.updateStatus(id, status, actorId);
  }
}
