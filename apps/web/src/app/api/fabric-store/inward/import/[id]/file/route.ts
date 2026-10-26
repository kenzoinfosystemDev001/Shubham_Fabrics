import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/fabric-store/inward/import/:id/file - the original uploaded file, as a download.
// ?inline=1 shows photos in the browser instead.
export async function GET(request: Request, { params }: Ctx) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;
  const { id } = await params;
  try {
    const record = await prisma.stockImport.findUnique({ where: { id }, select: { fileName: true, mimeType: true, fileData: true } });
    if (!record) return NextResponse.json({ error: 'Import not found.' }, { status: 404 });
    const inline = new URL(request.url).searchParams.get('inline') === '1' && record.mimeType.startsWith('image/');
    const bytes = Buffer.from(record.fileData);
    const asciiName = record.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
    return new Response(bytes, {
      headers: {
        'Content-Type': record.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(record.fileName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load the file.');
  }
}
