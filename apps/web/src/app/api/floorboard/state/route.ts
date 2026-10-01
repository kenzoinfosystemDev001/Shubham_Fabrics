import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const programs = await prisma.program.findMany({
      include: {
        customer: true,
        design: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        challans: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const draft = programs.filter((p) => p.status === 'DRAFT');
    const inProgress = programs.filter((p) => p.status === 'IN_PROGRESS' || p.status === 'SUBMITTED');
    const readyForIssue = programs.filter((p) => p.status === 'READY_FOR_ISSUE' || p.status === 'APPROVED');
    const issued = programs.filter((p) => p.status === 'ISSUED' || p.status === 'IN_PRODUCTION' || p.status === 'COMPLETED');

    return NextResponse.json({
      swimlanes: {
        DRAFT: draft,
        IN_PROGRESS: inProgress,
        READY_FOR_ISSUE: readyForIssue,
        ISSUED: issued,
      },
      totalCount: programs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
