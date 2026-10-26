import { SIDEBAR_IMAGE_KEY } from '@/lib/branding';
import { brandingAdminHandlers } from '@/lib/branding-server';

export const dynamic = 'force-dynamic';

// GET metadata · POST (multipart: file, altText) upload/replace · PATCH { isActive?, altText? } · DELETE restore default
export const { GET, POST, PATCH, DELETE } = brandingAdminHandlers({
  key: SIDEBAR_IMAGE_KEY,
  defaultAlt: 'Sidebar textile',
  folder: 'shubham-fabrics/branding',
  label: 'sidebar image',
});
