import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { dyeingErrorResponse, USER_NAME_SELECT } from '@/lib/dyeing-server';
import { issueDyeingQcChallan } from '@/lib/dyeing-qc-issue';

export const dynamic = 'force-dynamic';

/** GET /api/dyeing/qc-challans?search= — Dyeing -> Dyeing QC challans with their transferred lines. */
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  try {
    const search = new URL(request.url).searchParams.get('search')?.trim();
    const challans = await prisma.challan.findMany({
      where: {
        fromDepartment: 'DYEING',
        toDepartment: 'QC1',
        ...(search
          ? {
              OR: [
                { challanNumber: { contains: search, mode: 'insensitive' } },
                { program: { programNumber: { contains: search, mode: 'insensitive' } } },
                { program: { programSerialNo: { contains: search, mode: 'insensitive' } } },
                { program: { designNumber: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        program: { select: { id: true, programNumber: true, programSerialNo: true, designNumber: true, deliveryDate: true } },
        parentChallan: { select: { id: true, challanNumber: true } },
        issuedBy: { select: USER_NAME_SELECT },
        dyeingQcTransfers: { include: { dyeingOrder: { select: { id: true, orderNumber: true, inboundChallanId: true } } } },
      },
      orderBy: [{ issuedDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return NextResponse.json({ data: challans });
  } catch (error) {
    return dyeingErrorResponse(error, 'Failed to load Dyeing QC challans.');
  }
}

/**
 * POST /api/dyeing/qc-challans
 * Body: { idempotencyKey, challanNumber, issuedDate?, priority?, remarks?,
 *         lines: [{ orderId, quantity, actualDyedColor?, remarks? }] }
 */
export async function POST(request: Request) {
  const { user, response } = await requireDepartment(request, 'DYEING');
  if (!user) return response;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  return issueDyeingQcChallan(user, body);
}
