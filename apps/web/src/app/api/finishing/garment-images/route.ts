import { uploadFinishingGarmentImage } from '@/lib/garment-images-server';

export const dynamic = 'force-dynamic';

/** POST multipart { programId, garmentCategory, styleRef?, file } — image of a finished garment held in Finishing. */
export const POST = (request: Request) => uploadFinishingGarmentImage(request);
