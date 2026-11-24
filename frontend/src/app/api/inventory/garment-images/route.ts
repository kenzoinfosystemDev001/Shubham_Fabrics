import { uploadGarmentImage } from '@/lib/inventory-server';

export const dynamic = 'force-dynamic';

/** POST multipart { programId, garmentCategory, styleRef?, file } — upload or replace a complete-garment image. */
export const POST = (request: Request) => uploadGarmentImage(request);
