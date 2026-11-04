import { NextResponse } from 'next/server';
import { APP_BACKGROUND_ENABLED_SETTING, APP_BACKGROUND_KEY, type AppBackgroundConfig } from '@/lib/branding';
import { activeBrandingVersion, readBooleanSetting } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/branding/app-background/config — whether the shared department background is on, and the
 * version token of the active image ('' = default). Never cached, so an admin change shows on the next page load;
 * the image itself is fetched with ?v=<version> and cached for good.
 */
export async function GET() {
  const [enabled, version] = await Promise.all([
    readBooleanSetting(APP_BACKGROUND_ENABLED_SETTING, true),
    activeBrandingVersion(APP_BACKGROUND_KEY),
  ]);
  const config: AppBackgroundConfig = { enabled, version: version ?? '' };
  return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } });
}
