import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { getPackingActor } from '@/lib/packing-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await getPackingActor(request);
    if (!auth.actor) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // 1. Finished Goods Stock Balances (Snapshot)
    const stockWhere: any = {
      departmentCode: 'FINISHED_GOODS',
    };
    if (search) {
      stockWhere.OR = [
        { identifier: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const stockBalances = await prisma.inventoryStock.findMany({
      where: stockWhere,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    // 2. Physical Cartons in Warehouse
    const cartonWhere: any = {};
    if (status && status !== 'ALL') {
      cartonWhere.status = status;
    }
    if (search) {
      cartonWhere.OR = [
        { cartonNumber: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { program: { styleCode: { contains: search, mode: 'insensitive' } } },
        { program: { programNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const cartons = await prisma.carton.findMany({
      where: cartonWhere,
      include: {
        program: {
          select: {
            programNumber: true,
            styleCode: true,
            clientName: true,
            buyerName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 3. Recent Finished Goods Stock Ledger Movements (Audit Trail)
    const ledgerEntries = await prisma.stockLedgerEntry.findMany({
      where: {
        departmentCode: 'FINISHED_GOODS',
      },
      include: {
        program: {
          select: {
            programNumber: true,
            styleCode: true,
          },
        },
        actor: {
          select: {
            fullName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalStockQuantity = stockBalances.reduce(
      (sum, s) => sum + (Number(s.currentQuantity) || 0),
      0
    );

    const totalCartonsCount = cartons.length;
    const totalCartonPieces = cartons.reduce(
      (sum, c) => sum + (Number(c.quantity) || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalStockQuantity,
          totalCartonsCount,
          totalCartonPieces,
          activeSKUs: stockBalances.length,
        },
        stockBalances,
        cartons,
        ledgerEntries,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Finished Goods inventory:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load Finished Goods inventory' },
      { status: 500 }
    );
  }
}
