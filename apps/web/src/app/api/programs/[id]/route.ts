import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const program = await prisma.program.findUnique({
      where: { id },
      include: {
        customer: true,
        design: true,
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        fabrics: true,
        sizes: true,
        colours: true,
        challans: {
          include: {
            items: true,
            fromDeptRel: true,
            toDeptRel: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error: any) {
    console.error('Error fetching program:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch program' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify program exists
    const program = await prisma.program.findUnique({
      where: { id },
      select: { id: true, programNumber: true, programSerialNo: true },
    });

    if (!program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Cascade deletion safely inside a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Release fabric store rolls attached to this program
      await tx.fabricStoreRoll.updateMany({
        where: { programIssuedToId: id },
        data: { programIssuedToId: null, status: 'IN_STOCK' },
      });

      // 2. Delete challan items & events for all challans of this program
      const challans = await tx.challan.findMany({
        where: { programId: id },
        select: { id: true },
      });
      const challanIds = challans.map((c) => c.id);

      if (challanIds.length > 0) {
        await tx.challanItem.deleteMany({
          where: { challanId: { in: challanIds } },
        });
        await tx.challanEvent.deleteMany({
          where: { challanId: { in: challanIds } },
        });
        await tx.challan.deleteMany({
          where: { id: { in: challanIds } },
        });
      }

      // 3. Delete routes & steps
      const routes = await tx.programRoute.findMany({
        where: { programId: id },
        select: { id: true },
      });
      const routeIds = routes.map((r) => r.id);
      if (routeIds.length > 0) {
        await tx.programRouteStep.deleteMany({
          where: { programRouteId: { in: routeIds } },
        });
        await tx.programRoute.deleteMany({
          where: { id: { in: routeIds } },
        });
      }

      // 4. Delete BOM, specifications, sizes, colours, fabrics
      await tx.programBOM.deleteMany({ where: { programId: id } });
      await tx.programSpecification.deleteMany({ where: { programId: id } });
      await tx.programSize.deleteMany({ where: { programId: id } });
      await tx.programColour.deleteMany({ where: { programId: id } });
      await tx.programFabric.deleteMany({ where: { programId: id } });

      // 5. Finally, delete the program itself
      await tx.program.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: `Program ${program.programSerialNo || program.programNumber} successfully removed.`,
    });
  } catch (error: any) {
    console.error('Error deleting program:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove program' },
      { status: 500 }
    );
  }
}
