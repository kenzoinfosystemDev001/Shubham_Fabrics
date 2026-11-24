import { DEFAULT_SIDEBAR_IMAGE, SIDEBAR_IMAGE_KEY } from '@/lib/branding';
import { serveBrandingImage } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

/** GET /api/branding/sidebar-image — the one sidebar image of every department (signed-in users only, via middleware). */
export async function GET(request: Request) {
  return serveBrandingImage(request, {
    key: SIDEBAR_IMAGE_KEY,
    defaultUrl: DEFAULT_SIDEBAR_IMAGE,
    scope: 'private',
    cloudinaryTransform: 'c_limit,w_800,h_1600,q_auto,f_auto',
  });
}
