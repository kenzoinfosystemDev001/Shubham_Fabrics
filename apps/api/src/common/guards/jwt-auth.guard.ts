import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only a valid, signed JWT is accepted. Demo tokens and workstation fallbacks were removed.
    const result = await super.canActivate(context);
    if (!result) {
      throw new UnauthorizedException('Authentication token missing or invalid');
    }
    return true;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (user) return user;
    throw err || new UnauthorizedException('Authentication token missing or invalid');
  }
}
