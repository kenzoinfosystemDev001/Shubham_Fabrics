import { listGarmentImages } from '@/lib/garment-images-server';

export const dynamic = 'force-dynamic';

/** GET ?programIds=a,b — garment images of these Production Sheets (ids and versions, no image data). */
export const GET = (request: Request) => listGarmentImages(request);
