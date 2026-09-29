import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/permissions.decorator';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User authentication required for permission check');
    }

    // Check user roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
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
    });

    // Check if user has SUPER_ADMIN
    const isSuperAdmin = userRoles.some((ur) => ur.role.code === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      return true;
    }

    // Check if user has the specific required permission
    for (const req of required) {
      const hasPermission = userRoles.some((ur) =>
        ur.role.rolePerms.some(
          (rp) =>
            rp.permission.module === req.module &&
            rp.permission.resource === req.resource &&
            rp.permission.action === req.action,
        ),
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Permission denied! You lack permission: ${req.module}.${req.resource}.${req.action}`,
        );
      }
    }

    return true;
  }
}
