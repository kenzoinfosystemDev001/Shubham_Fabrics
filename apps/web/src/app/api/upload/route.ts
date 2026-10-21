import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getCloudinaryCredentials() {
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

/**
 * Diagnostic GET endpoint to check Cloudinary connection status.
 */
export async function GET() {
  const creds = getCloudinaryCredentials();

  return NextResponse.json({
    status: creds.isConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
    isConfigured: creds.isConfigured,
    configurationSource: creds.source,
    cloudName: creds.cloudName || null,
    hasApiKey: Boolean(creds.apiKey),
    hasApiSecret: Boolean(creds.apiSecret),
    message: creds.isConfigured
      ? `Cloudinary is configured for cloud '${creds.cloudName}'. Uploads will be delivered to Cloudinary CDN.`
      : 'Cloudinary credentials are not set. Uploads will fall back to local Base64 data URLs instead of Cloudinary.',
    requiredEnvVars: [
      'CLOUDINARY_CLOUD_NAME (or NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'OR single CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>',
    ],
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'shubham-fabrics';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const { cloudName, apiKey, apiSecret, isConfigured } = getCloudinaryCredentials();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;

    if (isConfigured && cloudName && apiKey && apiSecret) {
      const timestamp = Math.round(Date.now() / 1000);
      const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

      const cldForm = new FormData();
      cldForm.append('file', base64Data);
      cldForm.append('api_key', apiKey);
      cldForm.append('timestamp', timestamp.toString());
      cldForm.append('signature', signature);
      cldForm.append('folder', folder);

      const cldRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: cldForm,
      });

      if (cldRes.ok) {
        const cldData = await cldRes.json();
        return NextResponse.json({
          url: cldData.secure_url || cldData.url,
          publicId: cldData.public_id,
          width: cldData.width,
          height: cldData.height,
          format: cldData.format,
          isCloudinary: true,
        });
      }

      const errText = await cldRes.text().catch(() => '');
      console.warn('Cloudinary upload returned non-200 error, falling back to base64:', errText);
    } else {
      console.warn('Cloudinary credentials missing, falling back to local base64 data URL.');
    }

    // Graceful fallback to persistent base64 data URL
    return NextResponse.json({
      url: base64Data,
      publicId: `upload_${Date.now()}`,
      isFallback: true,
      isCloudinary: false,
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Image upload failed' },
      { status: 500 }
    );
  }
}
