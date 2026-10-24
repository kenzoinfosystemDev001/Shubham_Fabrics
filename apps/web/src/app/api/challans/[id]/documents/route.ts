import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireUser } from '@/lib/auth/require-user';
import { userBelongsToDepartment } from '@/lib/auth/department-access';
import { programSheetInclude, shapeProgramSheet } from '@/lib/program-sheet';

export const dynamic = 'force-dynamic';

const userSummary = { select: { id: true, username: true, fullName: true } };

// The sheet only; the program's other transfers are not part of this transfer's documents.
const { challans: _otherTransfers, ...sheetInclude } = programSheetInclude;

/**
 * Documents of one transfer: the challan itself and the original production sheet of the
 * program it carries. Only the sending and receiving departments (and Programming, which owns
 * the sheet) may read them; administrators always may.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  try {
    const { id } = await params;
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        items: true,
        fromDeptRel: true,
        toDeptRel: true,
        parentChallan: { select: { id: true, challanNumber: true, fromDepartment: true, toDepartment: true } },
        createdBy: userSummary,
        issuedBy: userSummary,
        receivedBy: userSummary,
      },
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }

    const allowed =
      userBelongsToDepartment(user, challan.toDepartment) ||
      userBelongsToDepartment(user, challan.fromDepartment) ||
      userBelongsToDepartment(user, 'PROGRAMMING');
    if (!allowed) {
      return NextResponse.json({ error: 'You do not have access to this challan.' }, { status: 403 });
    }

    const programRow = challan.programId
      ? await prisma.program.findUnique({ where: { id: challan.programId }, include: sheetInclude })
      : null;
    // metadataJson is kept non-null so the document modals use this sheet instead of refetching it.
    const program = programRow
      ? { ...shapeProgramSheet(programRow, user), metadataJson: programRow.metadataJson ?? '' }
      : null;

    return NextResponse.json({ challan: { ...challan, program }, program });
  } catch (error: any) {
    console.error('Error fetching challan documents:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch challan documents' }, { status: 500 });
  }
}
