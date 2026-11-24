import { serveGarmentImage } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET — the image (same as /api/garment-images/:id). */
export const GET = async (request: Request, { params }: Ctx) => serveGarmentImage(request, (await params).id);
