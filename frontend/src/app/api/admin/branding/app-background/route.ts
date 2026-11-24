import { APP_BACKGROUND_ENABLED_SETTING, APP_BACKGROUND_KEY } from '@/lib/branding';
import { brandingAdminHandlers } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

// GET metadata + on/off · POST (multipart: file, altText) upload/replace
// PATCH { enabled?, isActive?, altText? } · DELETE restore default image
export const { GET, POST, PATCH, DELETE } = brandingAdminHandlers({
  key: APP_BACKGROUND_KEY,
  defaultAlt: 'Department background',
  folder: 'shubham-fabrics/branding',
  label: 'department background',
  enabledSetting: APP_BACKGROUND_ENABLED_SETTING,
});
