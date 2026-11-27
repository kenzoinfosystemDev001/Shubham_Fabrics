import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DEPARTMENTS_KEY } from '../decorators/departments.decorator';

/** Department code that grants administrator access (stored on the user record). */
export const ADMIN_DEPARTMENT = 'ADMIN';

/**
 * Authorises by the department on the user record. Must run after JwtAuthGuard, which loads the
 * user from the database and rejects inactive accounts.
 *
 * - No user on the request: 401.
 * - Handler or controller without @Departments(...): denied (fails closed).
 * - Department ADMIN: allowed.
 * - Department listed in @Departments(...): allowed.
 * - Anything else: 403.
 */
@Injectable()
export class DepartmentsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const codes = this.reflector.getAllAndOverride<string[] | undefined>(DEPARTMENTS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!codes || codes.length === 0) {
      throw new ForbiddenException('Access denied.');
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { departmentCode?: string | null } | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    const department = String(user.departmentCode ?? '').trim().toUpperCase();
    if (department === ADMIN_DEPARTMENT) return true;

    const allowed = new Set(codes.map((code) => code.trim().toUpperCase()));
    if (department && allowed.has(department)) return true;

    throw new ForbiddenException('You do not have access to this department.');
  }
}
