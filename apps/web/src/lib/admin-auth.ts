import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getDefectiveShelfActor, type DefectiveShelfActor } from '@/lib/defective-shelf';

/**
 * Server-side guard for every Admin API. The caller must have a valid MES session for an
 * active user whose department is ADMIN or who holds the ADMIN / SUPER_ADMIN role.
 */
export async function requireAdmin(
  request: Request
): Promise<{ actor: DefectiveShelfActor; response: null } | { actor: null; response: NextResponse }> {
  const auth = await getDefectiveShelfActor(request);
  if (!auth.actor) return auth;
  if (!auth.actor.isAdmin) {
    return { actor: null, response: NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 }) };
  }
  return { actor: auth.actor, response: null };
}

/** Destructive or corrective admin actions must state why; the reason is kept in the audit log. */
export function readReason(body: unknown, minLength = 5): string | null {
  const reason = String((body as { reason?: unknown } | null)?.reason ?? '').trim();
  return reason.length >= minLength ? reason : null;
}

export function reasonRequiredResponse() {
  return NextResponse.json(
    { error: 'A reason of at least 5 characters is required for this action.', field: 'reason' },
    { status: 400 }
  );
}

type AuditDb = Pick<typeof prisma, 'auditLog'>;

export async function auditAdminAction(
  request: Request,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  details: { before?: unknown; after?: unknown } = {},
  db: AuditDb = prisma
) {
  await db.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      beforeState: details.before === undefined ? null : JSON.stringify(details.before),
      afterState: details.after === undefined ? null : JSON.stringify(details.after),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent')?.slice(0, 255) || null,
    },
  });
}

export function parsePage(searchParams: URLSearchParams, defaultSize = 50, maxSize = 200) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(searchParams.get('pageSize') || String(defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** Inclusive date range from `from` / `to` (YYYY-MM-DD) query params; `to` covers the whole day. */
export function parseDateRange(searchParams: URLSearchParams, fromKey = 'from', toKey = 'to') {
  const from = searchParams.get(fromKey);
  const to = searchParams.get(toKey);
  const range: { gte?: Date; lte?: Date } = {};
  if (from && !Number.isNaN(new Date(from).getTime())) range.gte = new Date(`${from.slice(0, 10)}T00:00:00.000Z`);
  if (to && !Number.isNaN(new Date(to).getTime())) range.lte = new Date(`${to.slice(0, 10)}T23:59:59.999Z`);
  return Object.keys(range).length > 0 ? range : undefined;
}
