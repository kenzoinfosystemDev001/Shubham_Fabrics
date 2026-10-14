import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const apkPath = path.join(process.cwd(), 'public', 'shubham-fabrics.apk');

  if (fs.existsSync(apkPath)) {
    const fileBuffer = fs.readFileSync(apkPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="Shubham_Fabrics.apk"',
      },
    });
  }

  // Redirect to home if apk not uploaded yet
  return NextResponse.redirect(new URL('/', req.url));
}
