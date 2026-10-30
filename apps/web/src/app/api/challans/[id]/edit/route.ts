import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { errorResponse } from '@/lib/work-items-server';
import { challanNumberErrorResponse } from '@/lib/challan-number-server';
import { FabricStockError, fabricStockErrorBody } from '@/lib/fabric-stock-ledger';
import { editChallan } from '@/lib/challan-edit-server';

export const dynamic = 'force-dynamic';

/**
 * POST { expectedUpdatedAt, challanNumber?, issuedDate?, priority?, remarks?, inchargeName?, editReason?,
 *        items: [{ id, itemDescription?, fabricCode?, colour?, shade?, requiredColour?, size?, rollNumber?, lotNumber?,
 *                  remarks?, average?, averageUnit?, unitQuantity?, unitQuantityUom?, quantity?, uom? }] }
 * Corrects an issued challan (lib/challan-edit-server.ts says what may change and when).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser(request);
  if (!user) return response;
  const body = await request.json().catch(() => ({}));
  try {
    const { id } = await params;
    const data = await editChallan(id, body, user);
    return NextResponse.json({ data, message: `Challan ${data?.challanNumber} updated.` });
  } catch (error) {
    if (error instanceof FabricStockError) return NextResponse.json(fabricStockErrorBody(error), { status: 409 });
    return challanNumberErrorResponse(error, body?.challanNumber) || errorResponse(error, 'Failed to update the challan.');
  }
}
