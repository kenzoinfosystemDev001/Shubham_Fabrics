/**
 * Upload rules for admin-managed appearance images (the sidebar image, login background and
 * department background — see lib/branding): allowed types, size limit and a real-content check.
 */

export const ALLOWED_DEPARTMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type DepartmentImageType = (typeof ALLOWED_DEPARTMENT_IMAGE_TYPES)[number];

export const MAX_DEPARTMENT_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_ALT_TEXT_LENGTH = 160;

/**
 * Detects the real image type from the file's leading bytes, so a renamed or mislabelled
 * upload cannot pass as an image. Returns null for anything that is not JPEG, PNG or WebP.
 */
export function sniffDepartmentImageType(bytes: Uint8Array): DepartmentImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return 'image/webp';
  }
  return null;
}

export type DepartmentImageValidation =
  | { ok: true; mimeType: DepartmentImageType }
  | { ok: false; error: string };

/** Size and content checks shared by the upload route and the admin form. */
export function validateDepartmentImage(bytes: Uint8Array): DepartmentImageValidation {
  if (bytes.length === 0) return { ok: false, error: 'The selected file is empty.' };
  if (bytes.length > MAX_DEPARTMENT_IMAGE_BYTES) {
    return { ok: false, error: `Image must be ${MAX_DEPARTMENT_IMAGE_BYTES / (1024 * 1024)} MB or smaller.` };
  }
  const mimeType = sniffDepartmentImageType(bytes);
  if (!mimeType) return { ok: false, error: 'Only JPG, PNG or WebP images are allowed.' };
  return { ok: true, mimeType };
}
