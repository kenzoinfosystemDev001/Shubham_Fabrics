import crypto from 'crypto';

export function getCloudinaryCredentials() {
  let cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  let apiKey = process.env.CLOUDINARY_API_KEY;
  let apiSecret = process.env.CLOUDINARY_API_SECRET;
  let source = 'none';

  if (cloudName && apiKey && apiSecret) {
    source = 'individual_vars';
  } else if (process.env.CLOUDINARY_URL) {
    try {
      // Format: cloudinary://<api_key>:<api_secret>@<cloud_name>
      const cldUrl = new URL(process.env.CLOUDINARY_URL);
      apiKey = decodeURIComponent(cldUrl.username);
      apiSecret = decodeURIComponent(cldUrl.password);
      cloudName = cldUrl.hostname;
      source = 'cloudinary_url';
    } catch (e) {
      console.warn('Failed to parse CLOUDINARY_URL environment variable:', e);
    }
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    isConfigured: Boolean(cloudName && apiKey && apiSecret),
    source,
  };
}

function sign(params: Record<string, string>, apiSecret: string): string {
  const stringToSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(stringToSign + apiSecret).digest('hex');
}

/**
 * Signed image upload. Returns null when Cloudinary is not configured; throws when it is
 * configured but rejects the upload, so callers do not silently store the file elsewhere.
 */
export async function uploadImageToCloudinary(
  dataUri: string,
  folder: string,
): Promise<{ url: string; publicId: string } | null> {
  const { cloudName, apiKey, apiSecret, isConfigured } = getCloudinaryCredentials();
  if (!isConfigured || !cloudName || !apiKey || !apiSecret) return null;

  const params = { folder, timestamp: Math.round(Date.now() / 1000).toString() };
  const form = new FormData();
  form.append('file', dataUri);
  form.append('api_key', apiKey);
  form.append('timestamp', params.timestamp);
  form.append('folder', folder);
  form.append('signature', sign(params, apiSecret));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Cloudinary upload failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return { url: data.secure_url || data.url, publicId: data.public_id };
}

/** Best-effort removal of a replaced or deleted asset; failures are logged, never thrown. */
export async function destroyCloudinaryImage(publicId: string | null | undefined): Promise<void> {
  const { cloudName, apiKey, apiSecret, isConfigured } = getCloudinaryCredentials();
  if (!publicId || !isConfigured || !cloudName || !apiKey || !apiSecret) return;

  try {
    const params = { public_id: publicId, timestamp: Math.round(Date.now() / 1000).toString() };
    const form = new FormData();
    form.append('public_id', publicId);
    form.append('api_key', apiKey);
    form.append('timestamp', params.timestamp);
    form.append('signature', sign(params, apiSecret));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', body: form });
    if (!res.ok) console.warn('Cloudinary destroy returned', res.status, 'for', publicId);
  } catch (error) {
    console.warn('Cloudinary destroy failed for', publicId, error);
  }
}

/** Adds a Cloudinary delivery transformation (e.g. resize + auto format) to a secure_url. */
export function cloudinaryTransformUrl(url: string, transformation: string): string {
  return url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/${transformation}/`) : url;
}
