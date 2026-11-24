import { SetMetadata } from '@nestjs/common';

export interface RequiredPermission {
  module: string;
  resource: string;
  action: string;
}

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (module: string, resource: string, action: string) =>
  SetMetadata(PERMISSIONS_KEY, [{ module, resource, action }]);
