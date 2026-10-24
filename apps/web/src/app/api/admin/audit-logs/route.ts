import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { parseDateRange, parsePage, requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/audit-logs?q=&action=&entity=&actorId=&from=&to=&page=
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePage(searchParams);
    const and: any[] = [];
    const q = searchParams.get('q')?.trim();
    if (q) {
      and.push({ OR: [
        { action: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { afterState: { contains: q, mode: 'insensitive' } },
        { beforeState: { contains: q, mode: 'insensitive' } },
      ] });
    }
    const action = searchParams.get('action')?.trim();
    if (action) and.push({ action });
    const entity = searchParams.get('entity')?.trim();
    if (entity) and.push({ entity });
    const actorId = searchParams.get('actorId')?.trim();
    if (actorId) and.push({ actorId });
    const created = parseDateRange(searchParams);
    if (created) and.push({ createdAt: created });
    const where = and.length > 0 ? { AND: and } : {};

    const [total, rows, actions, entities] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { actor: { select: { id: true, fullName: true, username: true } } },
      }),
      prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
      prisma.auditLog.findMany({ distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows,
      page,
      pageSize,
      total,
      facets: { actions: actions.map((a) => a.action), entities: entities.map((e) => e.entity) },
    });
  } catch (error: any) {
    console.error('Error loading audit logs:', error);
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 });
  }
}
