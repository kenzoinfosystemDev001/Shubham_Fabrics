import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'shubham-fabrics';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Support both server and client env variable names
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;

    if (cloudName && apiKey && apiSecret) {
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
        });
      }

      const errText = await cldRes.text().catch(() => '');
      console.warn('Cloudinary upload returned non-200, falling back:', errText);
    }

    // Graceful fallback to persistent base64 data URL
    return NextResponse.json({
      url: base64Data,
      publicId: `upload_${Date.now()}`,
      isFallback: true,
    });
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: error.message || 'Image upload failed' },
      { status: 500 }
    );
  }
}
