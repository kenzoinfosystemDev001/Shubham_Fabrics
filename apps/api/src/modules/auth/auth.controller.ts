import { Controller, Post, Get, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginSchema, CreateUserSchema } from '@subham/validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@subham/types';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any, @Req() req: Request) {
    try {
      const validated = LoginSchema.parse(body);
      const ip = req.ip || req.socket.remoteAddress;
      const ua = req.headers['user-agent'];
      return await this.authService.login(validated, ip, ua);
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        const msg = err.errors?.[0]?.message || 'Validation error';
        throw new BadRequestException(msg);
      }
      throw err;
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.PRODUCTION_MANAGER)
  async getUsers() {
    return this.authService.getAllUsers();
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async createUser(@Body() body: any, @CurrentUser('id') actorId: string) {
    const validated = CreateUserSchema.parse(body);
    return this.authService.createUser(validated, actorId);
  }
}
