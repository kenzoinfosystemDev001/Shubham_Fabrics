import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department') || 'PROGRAMMING';
    const deptCode =
      department === 'PROGRAMMING' ? 'PRG' :
      department === 'STORE' ? 'STR' :
      department === 'DYEING' ? 'DYE' :
      department === 'EMBROIDERY' ? 'EMB' :
      department === 'THREAD_CUTTING' ? 'THC' :
      department === 'QC1' ? 'QC1' :
      department === 'QC2' ? 'QC2' :
      department;
    const year = new Date().getFullYear();
    const prefix = `CH-${deptCode}-${year}-`;
    const count = await prisma.challan.count({
      where: { challanNumber: { startsWith: prefix } },
    });
    const nextSeq = String(count + 1).padStart(5, '0');
    return NextResponse.json({ nextNumber: `${prefix}${nextSeq}` });
  } catch (error: any) {
    console.error('Error generating next challan number:', error);
    return NextResponse.json({ nextNumber: `CH-PRG-${new Date().getFullYear()}-00001` });
  }
}
