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
