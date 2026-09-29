import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserSession } from '@subham/types';

export const CurrentUser = createParamDecorator(
  (data: keyof UserSession | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
