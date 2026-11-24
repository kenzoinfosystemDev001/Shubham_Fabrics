import { NextResponse } from 'next/server';
import { requireDepartment } from '@/lib/auth/department-access';
import { issueDyeingQcChallan } from '@/lib/dyeing-qc-issue';

export const dynamic = 'force-dynamic';

/**
 * POST /api/dyeing/orders/:id/issue-qc1-challan — single-line form of POST /api/dyeing/qc-challans.
 * Body: { challanNumber, quantityToSend, color?, remarks?, idempotencyKey? }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  return issueDyeingQcChallan(user, {
    idempotencyKey: body.idempotencyKey,
    challanNumber: body.challanNumber,
    issuedDate: body.issuedDate,
    priority: body.priority,
    remarks: body.remarks,
    lines: [{ orderId: id, quantity: body.quantityToSend, actualDyedColor: body.color, remarks: body.lineRemarks }],
  });
}
