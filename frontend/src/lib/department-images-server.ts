import { apiErrorResponse } from './api-errors';

/**
 * Error response for the appearance admin routes (sidebar image, login background, department
 * background). Setup problems (missing migration, outdated client) explain themselves.
 */
export function appearanceErrorResponse(error: unknown, message: string) {
  return apiErrorResponse(error, message);
}
