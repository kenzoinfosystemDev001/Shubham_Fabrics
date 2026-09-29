import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SubhamFabricsEnterpriseMESSecretKey2026SuperSecure_NoLeaks',
    });
  }

  async validate(payload: { sub: string; username: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePerms: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account inactive or not found');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const primaryRole = roles[0] || 'VIEWER';
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePerms.map(
            (rp) => `${rp.permission.module}.${rp.permission.resource}.${rp.permission.action}`,
          ),
        ),
      ),
    );

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: primaryRole,
      roles,
      permissions,
      departmentCode: user.departmentCode,
      isActive: user.isActive,
    };
  }
}
