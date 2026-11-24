import { NextResponse } from 'next/server';
import { SIDEBAR_IMAGE_KEY } from '@/lib/branding';
import { activeBrandingVersion } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/branding/sidebar-image/config — version token of the active sidebar image ('' = default,
 * null = could not be read). Never cached, so an admin change shows on the next page load; the image
 * itself is fetched with ?v=<version> and cached for good.
 */
export async function GET() {
  const version = await activeBrandingVersion(SIDEBAR_IMAGE_KEY);
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } });
}
