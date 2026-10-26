import { DEFAULT_LOGIN_BACKGROUND, LOGIN_BACKGROUND_KEY } from '@/lib/branding';
import { serveBrandingImage } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/branding/login-background
 * Public (see PUBLIC_API_PATHS in middleware): the login page shows it before anyone signs in.
 */
export async function GET(request: Request) {
  return serveBrandingImage(request, {
    key: LOGIN_BACKGROUND_KEY,
    defaultUrl: DEFAULT_LOGIN_BACKGROUND,
    scope: 'public',
    cloudinaryTransform: 'c_limit,w_2400,h_1600,q_auto,f_auto',
  });
}
