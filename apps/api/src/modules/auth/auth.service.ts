import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { LoginInput, CreateUserInput } from '@subham/validation';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: input.usernameOrEmail }, { email: input.usernameOrEmail }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials provided');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated. Contact factory administrator.');
    }

    const compareFn = (bcrypt as any).compare || (bcrypt as any).default?.compare;
    const isPasswordValid = await compareFn(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials provided');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      departmentCode: user.departmentCode,
    };

    const token = this.jwtService.sign(payload);

    // Record audit log for login
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        afterState: JSON.stringify({ username: user.username, role: user.role }),
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        departmentCode: user.departmentCode,
      },
    };
  }

  async createUser(input: CreateUserInput, actorId: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: input.username }, { email: input.email }],
      },
    });

    if (existing) {
      throw new BadRequestException('A user with this username or email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        role: input.role,
        departmentCode: input.departmentCode,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        departmentCode: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: user.id,
        afterState: JSON.stringify({ username: user.username, role: user.role }),
      },
    });

    return user;
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        departmentCode: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { username: 'asc' },
    });
  }
}
