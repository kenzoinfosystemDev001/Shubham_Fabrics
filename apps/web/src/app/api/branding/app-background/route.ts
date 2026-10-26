import { APP_BACKGROUND_KEY, DEFAULT_APP_BACKGROUND } from '@/lib/branding';
import { serveBrandingImage } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

/** GET /api/branding/app-background — the shared department background (signed-in users only, via middleware). */
export async function GET(request: Request) {
  return serveBrandingImage(request, {
    key: APP_BACKGROUND_KEY,
    defaultUrl: DEFAULT_APP_BACKGROUND,
    scope: 'private',
    cloudinaryTransform: 'c_limit,w_2400,h_1600,q_auto,f_auto',
  });
}
