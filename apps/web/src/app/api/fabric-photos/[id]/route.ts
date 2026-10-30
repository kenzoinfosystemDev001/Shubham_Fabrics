import { serveFabricPhoto } from '@/lib/fabric-photos-server';

export const dynamic = 'force-dynamic';

// GET /api/fabric-photos/:id?workItemId=   the image, when that work line may see it
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return serveFabricPhoto(request, id);
}
