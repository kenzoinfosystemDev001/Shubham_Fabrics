import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { parseDateRange, parsePage, requireAdmin } from '@/lib/admin-auth';
import { QC_DEPARTMENT_CODES } from '@/lib/departments';

export const dynamic = 'force-dynamic';

// GET /api/admin/qc-records?department=DYEING_QC|THREADCUT_QC|WASHING_QC|FINAL_QC&result=&q=&from=&to=&page=
// QC inspections with their quantity breakdown (from the QC production transaction) and any
// defect-shelf records raised from the same challan.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip } = parsePage(searchParams);
    const department = searchParams.get('department')?.trim().toUpperCase();
    const result = searchParams.get('result')?.trim().toUpperCase();
    const q = searchParams.get('q')?.trim();
    const inspected = parseDateRange(searchParams);

    const and: any[] = [{ departmentCode: department && QC_DEPARTMENT_CODES.includes(department) ? department : { in: QC_DEPARTMENT_CODES } }];
    if (result) and.push({ status: result });
    if (inspected) and.push({ inspectedAt: inspected });
    if (q) {
      and.push({ challan: { OR: [
        { challanNumber: { contains: q, mode: 'insensitive' } },
        { program: { programSerialNo: { contains: q, mode: 'insensitive' } } },
        { program: { designNumber: { contains: q, mode: 'insensitive' } } },
      ] } });
    }
    const where = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.qualityInspection.count({ where }),
      prisma.qualityInspection.findMany({
        where,
        orderBy: { inspectedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          inspector: { select: { fullName: true } },
          challan: {
            select: {
              id: true,
              challanNumber: true,
              fromDepartment: true,
              status: true,
              programId: true,
              program: { select: { programSerialNo: true, programNumber: true, designNumber: true } },
              items: { select: { fabricCode: true, colour: true, requiredDyeColor: true, shade: true, quantity: true, uom: true } },
              childChallans: { select: { id: true, challanNumber: true, toDepartment: true, challanType: true } },
            },
          },
          defects: { select: { defectType: true, count: true, severity: true } },
        },
      }),
    ]);

    const challanIds = rows.map((r) => r.challanId);
    const [transactions, shelfRecords] = await Promise.all([
      prisma.productionTransaction.findMany({
        where: { challanId: { in: challanIds }, departmentCode: { in: QC_DEPARTMENT_CODES } },
        select: { challanId: true, departmentCode: true, inputQuantity: true, goodQuantity: true, rejectQuantity: true, reworkQuantity: true, balanceQuantity: true, unitOfMeasure: true, recordedAt: true },
        orderBy: { recordedAt: 'desc' },
      }),
      prisma.defectRecord.findMany({
        where: { challanId: { in: challanIds } },
        select: { challanId: true, departmentCode: true, shelfCode: true, quantity: true, quantityUnit: true, reason: true, status: true, color: true, fabricType: true },
      }),
    ]);

    const data = rows.map((row) => {
      const tx = transactions.find((t) => t.challanId === row.challanId && t.departmentCode === row.departmentCode);
      const received = row.challan.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return {
        ...row,
        quantities: tx
          ? {
              received,
              inspected: tx.inputQuantity,
              passed: tx.goodQuantity,
              rejected: tx.rejectQuantity,
              rework: tx.reworkQuantity,
              uninspected: Math.max(0, Math.round((received - tx.inputQuantity) * 1000) / 1000),
              unit: tx.unitOfMeasure,
            }
          : null,
        shelfRecords: shelfRecords.filter((d) => d.challanId === row.challanId),
      };
    });

    return NextResponse.json({ success: true, data, page, pageSize, total });
  } catch (error: any) {
    console.error('Error loading QC records:', error);
    return NextResponse.json({ error: 'Failed to load QC records' }, { status: 500 });
  }
}
