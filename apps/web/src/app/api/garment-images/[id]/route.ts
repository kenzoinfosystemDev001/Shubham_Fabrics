import { serveGarmentImage } from '@/lib/garment-images-server';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET — the image of a finished garment (any signed-in user; shown on finished-garment challans). */
export const GET = async (request: Request, { params }: Ctx) => serveGarmentImage(request, (await params).id);
