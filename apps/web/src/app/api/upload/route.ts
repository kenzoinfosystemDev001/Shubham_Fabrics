import { NextResponse } from 'next/server';
import { getCloudinaryCredentials, uploadImageToCloudinary } from '@/lib/cloudinary';
import { sniffDepartmentImageType } from '@/lib/department-images';
import { requireUser } from '@/lib/auth/require-user';

export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ROOT_FOLDER = 'shubham-fabrics';

/** Diagnostic: whether Cloudinary is configured (administrators only; it describes server setup). */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request, { admin: true });
  if (!user) return response;
  const creds = getCloudinaryCredentials();
  return NextResponse.json({
    status: creds.isConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
    isConfigured: creds.isConfigured,
    configurationSource: creds.source,
    cloudName: creds.cloudName || null,
    message: creds.isConfigured
      ? `Cloudinary is configured for cloud '${creds.cloudName}'. Uploads will be delivered to Cloudinary CDN.`
      : 'Cloudinary credentials are not set. Uploads will fall back to local Base64 data URLs instead of Cloudinary.',
  });
}

/**
 * POST multipart { file, folder? } — an image (JPG, PNG or WebP, checked from its content, up to 10 MB)
 * stored on Cloudinary under shubham-fabrics/…, or returned as a data URL when Cloudinary is not set up.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image must be 10 MB or smaller.' }, { status: 400 });
    }
    // Only folders inside the app's own Cloudinary folder; a bare name (e.g. "production-sheets") goes under it.
    let requested = String(formData.get('folder') || ROOT_FOLDER).trim().toLowerCase();
    if (/^[a-z0-9_-]{1,40}$/.test(requested) && requested !== ROOT_FOLDER) requested = `${ROOT_FOLDER}/${requested}`;
    if (requested !== ROOT_FOLDER && !/^shubham-fabrics(\/[a-z0-9_-]{1,40}){1,3}$/.test(requested)) {
      return NextResponse.json({ error: 'Invalid upload folder.' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffDepartmentImageType(bytes);
    if (!mimeType) {
      return NextResponse.json({ error: 'Only JPG, PNG or WebP images are allowed.' }, { status: 400 });
    }
    const dataUri = `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;

    try {
      const uploaded = await uploadImageToCloudinary(dataUri, requested);
      if (uploaded) {
        return NextResponse.json({ url: uploaded.url, publicId: uploaded.publicId, isCloudinary: true });
      }
    } catch (error) {
      console.warn('Cloudinary upload failed, returning the image as a data URL:', error);
    }
    return NextResponse.json({ url: dataUri, publicId: `upload_${Date.now()}`, isFallback: true, isCloudinary: false });
  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json({ error: 'Image upload failed' }, { status: 500 });
  }
}
