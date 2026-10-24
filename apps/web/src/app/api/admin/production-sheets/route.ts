import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { parseDateRange, parsePage, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

function parseMeta(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** TOP / BOTTOM / DUPATTA (and named OTHER) components and Wilcom design numbers from the sheet metadata. */
function sheetComponents(meta: any) {
  const components = meta?.components && typeof meta.components === 'object' ? meta.components : {};
  const enabled = Object.keys(components).filter((key) => components[key]?.enabled !== false);
  const forwarded: string[] = Array.isArray(meta?.forwardedComponents) && meta.forwardedComponents.length > 0
    ? meta.forwardedComponents
    : enabled.length > 0 ? enabled : ['TOP'];
  const wilcom: Array<{ category: string; styleName: string; wilcomDesignNumber: string; hasPhoto: boolean }> = [];
  const entries = Array.isArray(meta?.wilcomEntries) ? meta.wilcomEntries : [];
  for (const entry of entries) {
    if (entry?.wilcomDesignNumber) {
      wilcom.push({
        category: String(entry.category || ''),
        styleName: String(entry.styleName || ''),
        wilcomDesignNumber: String(entry.wilcomDesignNumber),
        hasPhoto: Boolean(entry.photoUrl || entry.photo || entry.wilcomDesignPhoto),
      });
    }
  }
  return {
    types: Object.keys(components).map((key) => ({
      category: key,
      name: String(components[key]?.styleName || key),
      enabled: components[key]?.enabled !== false,
      forwarded: forwarded.includes(key),
    })),
    forwarded,
    wilcom,
  };
}

// GET /api/admin/production-sheets?q=&type=TOP|BOTTOM|DUPATTA|OTHER&status=&wilcom=1&dateFrom=&dateTo=&page=
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePage(searchParams);
    const q = searchParams.get('q')?.trim();
    const status = searchParams.get('status')?.trim().toUpperCase();
    const type = searchParams.get('type')?.trim().toUpperCase();
    const wilcomOnly = searchParams.get('wilcom') === '1';
    const created = parseDateRange(searchParams, 'dateFrom', 'dateTo');

    const and: any[] = [];
    if (q) {
      and.push({ OR: [
        { id: q },
        { programNumber: { contains: q, mode: 'insensitive' } },
        { programSerialNo: { contains: q, mode: 'insensitive' } },
        { designNumber: { contains: q, mode: 'insensitive' } },
        { wilcomDesignNumber: { contains: q, mode: 'insensitive' } },
        { clientName: { contains: q, mode: 'insensitive' } },
      ] });
    }
    if (status) and.push({ status });
    if (created) and.push({ createdAt: created });
    const where = and.length > 0 ? { AND: and } : {};
    const select = {
      id: true,
      programNumber: true,
      programSerialNo: true,
      designNumber: true,
      wilcomDesignNumber: true,
      clientName: true,
      buyerName: true,
      status: true,
      deliveryDate: true,
      createdAt: true,
      updatedAt: true,
      metadataJson: true,
      createdBy: { select: { fullName: true } },
      _count: { select: { challans: true } },
    } as const;
    const shape = (rows: any[]) => rows.map(({ metadataJson, ...row }) => {
      const components = sheetComponents(parseMeta(metadataJson));
      if (row.wilcomDesignNumber && !components.wilcom.some((w) => w.wilcomDesignNumber === row.wilcomDesignNumber)) {
        components.wilcom.unshift({ category: '', styleName: '', wilcomDesignNumber: row.wilcomDesignNumber, hasPhoto: false });
      }
      return { ...row, ...components };
    });

    // Sheet types and Wilcom forms live in the sheet metadata, so those filters are applied
    // after parsing, over the full result, before paginating (keeps totals exact).
    if (type || wilcomOnly) {
      const all = shape(await prisma.program.findMany({ where, orderBy: { createdAt: 'desc' }, select }))
        .filter((row) => !type || row.types.some((t: any) => t.category === type))
        .filter((row) => !wilcomOnly || row.wilcom.length > 0);
      return NextResponse.json({ success: true, data: all.slice(skip, skip + pageSize), page, pageSize, total: all.length });
    }

    const [total, rows] = await Promise.all([
      prisma.program.count({ where }),
      prisma.program.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, select }),
    ]);
    const data = shape(rows);

    return NextResponse.json({ success: true, data, page, pageSize, total });
  } catch (error: any) {
    console.error('Error listing production sheets:', error);
    return NextResponse.json({ error: 'Failed to load production sheets' }, { status: 500 });
  }
}
