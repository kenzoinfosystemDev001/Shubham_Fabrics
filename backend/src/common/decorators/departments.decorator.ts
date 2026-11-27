import { SetMetadata } from '@nestjs/common';

export const DEPARTMENTS_KEY = 'departments';

/**
 * Department codes allowed to call the decorated handler or controller. Matched against the
 * department stored on the user record in the database (req.user.departmentCode), never against a
 * token claim, username or request value. Administrators (department ADMIN) always pass.
 */
export const Departments = (...codes: string[]) => SetMetadata(DEPARTMENTS_KEY, codes);
