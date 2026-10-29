import { listFabricPhotos, uploadFabricPhoto } from '@/lib/fabric-photos-server';

export const dynamic = 'force-dynamic';

// GET  /api/fabric-photos?workItemId=   photos this work line's department may see
// POST /api/fabric-photos (multipart: workItemId, file)   Embroidery, Threadcut QC, Stitching
export async function GET(request: Request) {
  return listFabricPhotos(request);
}

export async function POST(request: Request) {
  return uploadFabricPhoto(request);
}
