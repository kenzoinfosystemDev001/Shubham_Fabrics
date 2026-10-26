import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { canViewClientCode, getSessionUser } from '@/lib/auth/require-user';
import { productionSheetCategories } from '@/lib/download-production-sheet';

/** A photo column as the list sends it: data: URLs are served by /api/programs/:id/photo instead. */
function photoUrlFor(id: string, kind: 'wilcom' | 'base', value: string | null, updatedAt: Date) {
  if (!value) return value;
  return value.startsWith('data:') ? `/api/programs/${id}/photo?kind=${kind}&v=${new Date(updatedAt).getTime()}` : value;
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { programNumber: { contains: term, mode: 'insensitive' } },
        { programSerialNo: { contains: term, mode: 'insensitive' } },
        { buyerName: { contains: term, mode: 'insensitive' } },
        { clientName: { contains: term, mode: 'insensitive' } },
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { styleCode: { contains: term, mode: 'insensitive' } },
        { mainStyle: { contains: term, mode: 'insensitive' } },
        { designName: { contains: term, mode: 'insensitive' } },
        { designNumber: { contains: term, mode: 'insensitive' } },
        { wilcomDesignNumber: { contains: term, mode: 'insensitive' } },
        { fabricName: { contains: term, mode: 'insensitive' } },
        { fabricColor: { contains: term, mode: 'insensitive' } },
      ];
    }

    // The list feeds dashboards, dropdowns and the archive: scalar columns plus the few derived fields the
    // screens read. Documents (print / download / preview) load the full sheet from /api/programs/:id when
    // metadataJson is absent, so it is not sent here (it can hold base64 artwork and the client code).
    const programs = await prisma.program.findMany({
      where,
      include: {
        challans: {
          select: {
            id: true,
            programId: true,
            challanNumber: true,
            challanType: true,
            fromDepartment: true,
            toDepartment: true,
            status: true,
            priority: true,
            issuedDate: true,
            receivedDate: true,
            remarks: true,
            items: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Role/department access restriction: ONLY Programming and Admin can see clientCode
    const sessionUser = await getSessionUser(request);
    const isAuthorized = !!sessionUser && canViewClientCode(sessionUser);

    const mapped = programs.map(({ metadataJson, ...p }: any) => {
      let items: any[] = [];
      let subStyles: string[] = [];
      let topName = '';
      let serialNoCounter = '000';
      let note = '';
      let clientCode = '';
      let wilcomEntries: any[] = [];
      let sheetCount = 1;

      try {
        if (metadataJson) {
          const parsed = JSON.parse(metadataJson);
          if (Array.isArray(parsed.items)) items = parsed.items;
          if (Array.isArray(parsed.subStyles)) subStyles = parsed.subStyles;
          if (parsed.topName) topName = parsed.topName;
          if (parsed.serialNoCounter) serialNoCounter = parsed.serialNoCounter;
          if (parsed.note) note = parsed.note;
          if (parsed.clientCode) clientCode = parsed.clientCode;
          // Wilcom entries without their artwork (photos load with the full sheet).
          if (Array.isArray(parsed.wilcomEntries)) wilcomEntries = parsed.wilcomEntries.map(({ photoUrl, photo, imageUrl, image, ...e }: any) => e);
          sheetCount = productionSheetCategories({ metadataJson }).length;
        }
      } catch {}

      if (subStyles.length === 0 && p.subStyle) {
        subStyles = p.subStyle.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      return {
        ...p,
        // Inline (base64) photos become a cached image URL; stored URLs pass through unchanged.
        wilcomDesignPhoto: photoUrlFor(p.id, 'wilcom', p.wilcomDesignPhoto, p.updatedAt),
        baseDesignPhoto: photoUrlFor(p.id, 'base', p.baseDesignPhoto, p.updatedAt),
        buyer: p.clientName || p.buyerName,
        buyerName: p.clientName || p.buyerName,
        challans: p.challans.map((c: any) => ({ ...c, program: { id: p.id } })),
        items,
        subStyles,
        wilcomEntries,
        sheetCount,
        topName: topName || p.mainStyle || p.styleCode,
        serialNoCounter,
        note: note || p.comments || p.remarks || '',
        clientCode: isAuthorized ? clientCode : null,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching programs:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch programs' }, { status: 500 });
  }
}
