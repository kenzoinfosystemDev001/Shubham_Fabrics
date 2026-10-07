import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            fabrics: true,
            fabricRolls: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(suppliers);
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const code = (body.code || `SUP-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
    const contactPerson = (body.contactPerson || '').trim();
    const phone = (body.phone || '').trim();
    const email = (body.email || '').trim();
    const taxNumber = (body.taxNumber || '').trim();
    const address = (body.address || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.upsert({
      where: { code },
      update: {
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        taxNumber: taxNumber || null,
        address: address || null,
      },
      create: {
        code,
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        taxNumber: taxNumber || null,
        address: address || null,
      },
    });

    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create supplier' },
      { status: 500 }
    );
  }
}
