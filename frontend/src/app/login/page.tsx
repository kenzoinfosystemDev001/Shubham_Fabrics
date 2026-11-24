import { preload } from 'react-dom';
import { DEFAULT_LOGIN_BACKGROUND, LOGIN_BACKGROUND_KEY, loginBackgroundSrc } from '@/lib/branding';
import { activeBrandingVersion } from '@/lib/branding-server';
import { LoginScreen } from './LoginScreen';

// The background is read on every request, so a change in Admin > Appearance shows on the next visit.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const version = await activeBrandingVersion(LOGIN_BACKGROUND_KEY);
  // null = lookup failed: keep the neutral canvas rather than guess (the default may not be what is active).
  const backgroundSrc = version === null ? null : version ? loginBackgroundSrc(version) : DEFAULT_LOGIN_BACKGROUND;
  // Starts the download from the HTML head, before the page's JavaScript has loaded.
  if (backgroundSrc) preload(backgroundSrc, { as: 'image', fetchPriority: 'high' });
  return <LoginScreen backgroundSrc={backgroundSrc} />;
}
