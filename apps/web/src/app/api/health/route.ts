import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const programCount = await prisma.program.count();
    return NextResponse.json({
      status: 'ok',
      service: 'Shubham Fabrics Web & MES Gateway',
      database: 'connected',
      programCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      database: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
