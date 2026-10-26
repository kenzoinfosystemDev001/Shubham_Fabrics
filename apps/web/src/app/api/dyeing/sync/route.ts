import { NextResponse } from 'next/server';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';
import { requireDepartment } from '@/lib/auth/department-access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user: authUser, response: authResponse } = await requireDepartment(request, 'DYEING');
  if (!authUser) return authResponse;
  try {
    const synced = await syncInboundChallansToDyeingOrders();
    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${synced.length} inbound challan(s) to Dyeing Orders`,
      syncedOrders: synced,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
