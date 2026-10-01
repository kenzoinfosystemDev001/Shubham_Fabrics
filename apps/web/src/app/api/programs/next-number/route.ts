import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const year = new Date().getFullYear();
    const prefix = `PRG-${year}-`;
    const count = await prisma.program.count({
      where: { programNumber: { startsWith: prefix } },
    });
    const nextSeq = String(count + 1).padStart(5, '0');
    return NextResponse.json({ nextNumber: `${prefix}${nextSeq}` });
  } catch (error: any) {
    console.error('Error generating next program number:', error);
    return NextResponse.json({ nextNumber: `PRG-${new Date().getFullYear()}-00001` });
  }
}
