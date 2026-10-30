import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { DEPARTMENT_NAV_BG_RECORD } from '@/lib/nav-bg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('raw') === 'true';

    // 1. Fetch real image record from PostgreSQL database
    const attachment = await prisma.attachment.findFirst({
      where: { entityType: 'DEPARTMENT_NAV_BG' },
      orderBy: { createdAt: 'desc' },
    });

    if (!attachment) {
      if (raw) {
        const base64Data = DEPARTMENT_NAV_BG_RECORD.dataUri.split(';base64,').pop() || '';
        const imageBuffer = Buffer.from(base64Data, 'base64');
        return new Response(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': DEPARTMENT_NAV_BG_RECORD.fileType,
            'Content-Length': imageBuffer.length.toString(),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
          },
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            fileUrl: DEPARTMENT_NAV_BG_RECORD.dataUri,
            isFallback: true,
          },
        }
      );
    }

    // If raw binary image requested, extract and stream with image/png header
    if (raw) {
      if (attachment.fileUrl.startsWith('data:image/')) {
        const base64Data = attachment.fileUrl.split(';base64,').pop() || '';
        const imgBuffer = Buffer.from(base64Data, 'base64');
        return new Response(imgBuffer, {
          status: 200,
          headers: {
            'Content-Type': attachment.fileType || 'image/png',
            'Content-Length': imgBuffer.length.toString(),
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: attachment.id,
        entityType: attachment.entityType,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileUrl: attachment.fileUrl,
        fileSize: attachment.fileSize,
        createdAt: attachment.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error fetching department navigation background from DB:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch background image from database.' },
      { status: 500 }
    );
  }
}
