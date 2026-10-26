import { DEFAULT_LOGIN_BACKGROUND_ALT, LOGIN_BACKGROUND_KEY } from '@/lib/branding';
import { brandingAdminHandlers } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

// GET metadata · POST (multipart: file, altText) upload/replace · PATCH { isActive?, altText? } · DELETE restore default
export const { GET, POST, PATCH, DELETE } = brandingAdminHandlers({
  key: LOGIN_BACKGROUND_KEY,
  defaultAlt: DEFAULT_LOGIN_BACKGROUND_ALT,
  folder: 'shubham-fabrics/branding',
  label: 'login background',
});
