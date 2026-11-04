/**
 * Admin-managed branding images (BrandingAsset rows, one per key). Upload rules are shared with the
 * department images (JPG/PNG/WebP, size limit, real-content check) via lib/department-images.
 */

export const LOGIN_BACKGROUND_KEY = 'LOGIN_BACKGROUND';

/** Shown when no active login background is configured, or the configured one cannot be loaded. */
export const DEFAULT_LOGIN_BACKGROUND = '/textures/login-default.jpg';

/**
 * Cache key for one uploaded image. The row id is part of it because "Restore Default" deletes the row,
 * so a later upload starts again at version 1 and must not match a URL browsers already cached for good.
 */
export function brandingVersionToken(id: string, version: number): string {
  return `${id.slice(0, 8)}.${version}`;
}

/**
 * Public image route for the login background. The login page and the admin preview both pass the
 * active image's version token, so the URL changes (and the cache is bypassed) whenever the image does.
 */
export function loginBackgroundSrc(version?: string): string {
  return version ? `/api/branding/login-background?v=${version}` : '/api/branding/login-background';
}

export const DEFAULT_LOGIN_BACKGROUND_ALT = 'Textile background';

/** One textile image shared by the sidebar of every department. */
export const SIDEBAR_IMAGE_KEY = 'SIDEBAR_IMAGE';
export const DEFAULT_SIDEBAR_IMAGE = '/textures/fabric-default.jpg';

/** Versioned URLs are cached for good; the version changes whenever the admin changes the image. */
export function sidebarImageSrc(version?: string): string {
  return version ? `/api/branding/sidebar-image?v=${version}` : '/api/branding/sidebar-image';
}

/** One background shared by the content area of every department page. */
export const APP_BACKGROUND_KEY = 'APP_BACKGROUND';
export const DEFAULT_APP_BACKGROUND = '/textures/login-default.jpg';
/** AppSetting key holding the department background on/off switch (on when unset). */
export const APP_BACKGROUND_ENABLED_SETTING = 'APP_BACKGROUND_ENABLED';

/** Versioned URLs are cached for good; the version changes whenever the admin changes the image. */
export function appBackgroundSrc(version?: string): string {
  return version ? `/api/branding/app-background?v=${version}` : '/api/branding/app-background';
}

export interface AppBackgroundConfig {
  enabled: boolean;
  /** Version token of the active image; empty when the default image is in use. */
  version: string;
}
