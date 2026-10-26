import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET ?kind=wilcom|base&v= — a Production Sheet's Wilcom or base design photo as an image, so lists can
 * show thumbnails without carrying base64 data in their JSON. Signed-in users only (middleware).
 * The list adds v=<updatedAt>, so a versioned URL may be cached until the sheet changes.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') === 'base' ? 'base' : 'wilcom';
  try {
    const program = await prisma.program.findUnique({
      where: { id },
      select: kind === 'base' ? { baseDesignPhoto: true } : { wilcomDesignPhoto: true },
    });
    const value: string | null | undefined = kind === 'base' ? (program as any)?.baseDesignPhoto : (program as any)?.wilcomDesignPhoto;
    if (!value) return NextResponse.json({ error: 'No photo.' }, { status: 404 });
    const cache = url.searchParams.has('v') ? 'private, max-age=31536000, immutable' : 'private, max-age=60';
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/s.exec(value);
    if (match) {
      const bytes = Buffer.from(match[2], 'base64');
      return new Response(bytes, {
        headers: { 'Content-Type': match[1], 'Content-Length': String(bytes.length), 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
      });
    }
    if (/^https:\/\//.test(value)) return NextResponse.redirect(value, { status: 302, headers: { 'Cache-Control': cache } });
    return NextResponse.json({ error: 'Unsupported photo.' }, { status: 404 });
  } catch (error) {
    return apiErrorResponse(error, 'Failed to load the photo.');
  }
}
