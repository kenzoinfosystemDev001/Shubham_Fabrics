import { NextResponse } from 'next/server';
import { syncInboundChallansToDyeingOrders } from '@/lib/dyeing-sync';

export const dynamic = 'force-dynamic';

export async function GET() {
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

export async function POST() {
  return GET();
}
