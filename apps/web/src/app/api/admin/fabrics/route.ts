import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fabrics = await prisma.fabric.findMany({
      include: {
        supplier: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(fabrics);
  } catch (error: any) {
    console.error('Error fetching fabrics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fabrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const code = (body.code || `FAB-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
    const fabricType = (body.fabricType || 'KNIT_PIQUE').trim();
    const composition = (body.composition || '100% Cotton').trim();
    const widthInInches = parseFloat(body.widthInInches || 60);
    const gsm = parseFloat(body.gsm || 220);
    const weaveType = body.weaveType ? body.weaveType.trim() : null;
    const supplierId = body.supplierId || null;

    if (!name) {
      return NextResponse.json({ error: 'Fabric name is required' }, { status: 400 });
    }

    const fabric = await prisma.fabric.upsert({
      where: { code },
      update: {
        name,
        fabricType,
        composition,
        widthInInches,
        gsm,
        weaveType,
        supplierId,
      },
      create: {
        code,
        name,
        fabricType,
        composition,
        widthInInches,
        gsm,
        weaveType,
        supplierId,
      },
      include: {
        supplier: true,
      },
    });

    return NextResponse.json({ success: true, fabric });
  } catch (error: any) {
    console.error('Error creating fabric:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create fabric' },
      { status: 500 }
    );
  }
}
