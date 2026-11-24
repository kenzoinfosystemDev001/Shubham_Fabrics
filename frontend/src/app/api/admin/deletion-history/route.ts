import { NextResponse } from 'next/server';
import { prisma } from '@shubham/database';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';

export const dynamic = 'force-dynamic';

/** Audit actions that delete (or undo) a record, with the label the history shows. */
const DELETE_ACTIONS: Record<string, string> = {
  CHALLAN_DELETED: 'Challan deleted',
  PROGRAM_DELETED: 'Production Sheet deleted',
  RECEIPT_DELETED: 'Received entry deleted',
  HOLD_DELETED: 'HOLD deleted',
  ALL_CHALLANS_DELETED: 'All challans deleted',
  ALL_PRODUCTION_SHEETS_DELETED: 'All Production Sheets deleted',
};

const parse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** GET ?search= : every delete across the MES, newest first, with who did it, when and why (Admin only). */
export async function GET(request: Request) {
  const { user, response } = await requireUser(request, { admin: true });
  if (!user) return response;
  try {
    const q = new URL(request.url).searchParams.get('search')?.trim().toLowerCase() || '';
    const rows = await prisma.auditLog.findMany({
      where: { action: { in: Object.keys(DELETE_ACTIONS) } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { actor: { select: { fullName: true, username: true, departmentCode: true } } },
    });
    const data = rows
      .map((r) => {
        const before = parse(r.beforeState) || {};
        return {
          id: r.id,
          action: r.action,
          label: DELETE_ACTIONS[r.action] || r.action,
          entity: r.entity,
          entityId: r.entityId,
          // Challan / sheet deletes keep a snapshot; receipt and HOLD deletes keep the confirmation details.
          reference: before.challanNumber || before['Challan Number'] || before.productionSheet || before.Record || r.entityId,
          productionSheet: before.productionSheet || before['Production Sheet'] || null,
          designNumber: before.designNumber || before['Design Number'] || null,
          department: before.fromDepartment || before.Department || before.departmentCode || null,
          quantity: before.quantity || null,
          reason: before.reason || null,
          by: r.actor?.fullName || r.actor?.username || '—',
          at: r.createdAt,
        };
      })
      .filter((r) => !q || [r.label, r.reference, r.productionSheet, r.designNumber, r.department, r.reason, r.by].some((v) => String(v || '').toLowerCase().includes(q)));
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error, 'Failed to load the deletion history.');
  }
}

/** The phrase an administrator types to clear the history in bulk. */
const CLEAR_PHRASE = 'CLEAR HISTORY';

/**
 * DELETE { scope: 'ALL' | 'BEFORE' | 'ONE', before?: 'YYYY-MM-DD', id?, confirm } : clears Deletion History (Admin only).
 * Only the delete entries this history lists are removed; nothing else in the audit log, and no production data.
 * Bulk clears need the typed phrase. The clear itself is recorded (DELETION_HISTORY_CLEARED), not listed here.
 */
export async function DELETE(request: Request) {
  const { user, response } = await requireUser(request, { admin: true });
  if (!user) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const scope = String(body.scope || '').toUpperCase();
    const where: any = { action: { in: Object.keys(DELETE_ACTIONS) } };
    let description: string;
    if (scope === 'ONE') {
      const id = String(body.id || '');
      if (!id) return NextResponse.json({ error: 'Choose the entry to remove.' }, { status: 400 });
      where.id = id;
      description = 'one entry';
    } else if (scope === 'ALL' || scope === 'BEFORE') {
      if (String(body.confirm || '').trim().toUpperCase() !== CLEAR_PHRASE) {
        return NextResponse.json({ error: `Type ${CLEAR_PHRASE} to confirm.` }, { status: 400 });
      }
      if (scope === 'BEFORE') {
        const before = new Date(`${String(body.before || '')}T00:00:00`);
        if (Number.isNaN(before.getTime())) return NextResponse.json({ error: 'Choose the date to clear before.' }, { status: 400 });
        where.createdAt = { lt: before };
        description = `entries before ${String(body.before)}`;
      } else {
        description = 'all entries';
      }
    } else {
      return NextResponse.json({ error: 'Choose what to clear.' }, { status: 400 });
    }
    const removed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.auditLog.deleteMany({ where });
      if (count > 0) {
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'DELETION_HISTORY_CLEARED',
            entity: 'AuditLog',
            entityId: scope === 'ONE' ? String(body.id) : scope,
            afterState: JSON.stringify({ scope, before: body.before || null, removed: count }),
          },
        });
      }
      return count;
    });
    if (scope === 'ONE' && removed === 0) return NextResponse.json({ error: 'This entry was already removed.' }, { status: 404 });
    return NextResponse.json({ removed, message: removed ? `Deletion History: ${removed} entr${removed === 1 ? 'y' : 'ies'} cleared (${description}).` : 'Nothing to clear.' });
  } catch (error) {
    return errorResponse(error, 'Failed to clear the deletion history.');
  }
}
