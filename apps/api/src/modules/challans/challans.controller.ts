import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ChallansService } from './challans.service';
import { CreateChallanSchema } from '@subham/validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChallanStatus, DepartmentCode } from '@subham/types';

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
  async createChallan(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateChallanSchema.parse(body);
    return this.challansService.create(validated, actorId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: ChallanStatus,
    @Body('notes') notes: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.challansService.transitionStatus(id, status, actorId, notes);
  }
}
