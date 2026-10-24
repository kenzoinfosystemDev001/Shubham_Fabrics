import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { parseDateRange, requireAdmin } from '@/lib/admin-auth';
import { CANCELLED_CHALLAN_STATUSES, COMPLETED_CHALLAN_STATUSES, challanStatusGroup, sumByUnit } from '@/lib/admin-metrics';
import { MES_DEPARTMENTS } from '@/lib/departments';
import { loadFabricStockLedger } from '@/lib/fabric-stock-ledger';
import { syncAllDeadlineAlerts } from '@/lib/deadline-alerts/engine';

export const dynamic = 'force-dynamic';

// GET /api/admin/overview?from=YYYY-MM-DD&to=YYYY-MM-DD&department=CODE
// Every figure is read from the database; nothing is estimated or defaulted.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const range = parseDateRange(searchParams);
    const department = searchParams.get('department')?.trim().toUpperCase() || null;

    const challanWhere: any = {};
    if (range) challanWhere.createdAt = range;
    if (department) challanWhere.OR = [{ fromDepartment: department }, { toDepartment: department }];

    // Keep alert state current before counting it.
    await syncAllDeadlineAlerts().catch((err) => console.warn('[admin/overview] alert sync failed:', err));

    const [
      productionSheets,
      challansByStatus,
      inward,
      ledger,
      defects,
      departmentRows,
      totalUsers,
      activeUsers,
      activeAlerts,
      overdueAlerts,
    ] = await Promise.all([
      prisma.program.count({ where: range ? { createdAt: range } : undefined }),
      prisma.challan.groupBy({ by: ['status'], where: challanWhere, _count: { _all: true } }),
      prisma.fabricInward.findMany({ where: range ? { receivingDate: range } : undefined, select: { billQty: true, unit: true } }),
      loadFabricStockLedger(),
      prisma.defectRecord.findMany({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] }, shelfRemovedAt: null, ...(department ? { departmentCode: department } : {}) },
        select: { quantity: true, quantityUnit: true },
      }),
      prisma.department.findMany({ where: { code: { in: MES_DEPARTMENTS.map((d) => d.code) } }, select: { code: true, isActive: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.deadlineAlert.count({ where: { status: 'ACTIVE', ...(department ? { departmentCode: department } : {}) } }),
      prisma.deadlineAlert.count({ where: { status: 'ACTIVE', stage: 'OVERDUE', ...(department ? { departmentCode: department } : {}) } }),
    ]);

    const statusCounts = challansByStatus.map((row) => ({ status: row.status, count: row._count._all, group: challanStatusGroup(row.status) }));
    const countGroup = (group: string) => statusCounts.filter((s) => s.group === group).reduce((n, s) => n + s.count, 0);

    const outwardInRange = ledger.outwardHistory.filter((row) => {
      if (!range) return true;
      const t = new Date(row.date).getTime();
      return (!range.gte || t >= range.gte.getTime()) && (!range.lte || t <= range.lte.getTime());
    });
    const stockRows = Array.from(ledger.rows.values());
    const inactive = new Set(departmentRows.filter((d) => !d.isActive).map((d) => d.code));

    return NextResponse.json({
      success: true,
      data: {
        filters: { from: searchParams.get('from'), to: searchParams.get('to'), department },
        productionSheets,
        challans: {
          total: statusCounts.reduce((n, s) => n + s.count, 0),
          pending: countGroup('PENDING'),
          completed: countGroup('COMPLETED'),
          cancelled: countGroup('CANCELLED'),
          byStatus: statusCounts.sort((a, b) => b.count - a.count),
          completedStatuses: COMPLETED_CHALLAN_STATUSES,
          cancelledStatuses: CANCELLED_CHALLAN_STATUSES,
        },
        // Fabric Store material, per unit (meters and pieces are never added together).
        inwardMaterial: sumByUnit(inward, (r) => r.billQty, (r) => r.unit),
        outwardMaterial: sumByUnit(outwardInRange, (r) => r.quantity, (r) => r.unit),
        currentStock: sumByUnit(stockRows, (r) => Math.max(0, r.rawBalance), (r) => r.unit),
        defectiveStock: sumByUnit(defects, (r) => r.quantity, (r) => r.quantityUnit),
        departments: { total: MES_DEPARTMENTS.length, active: MES_DEPARTMENTS.filter((d) => !inactive.has(d.code)).length },
        users: { total: totalUsers, active: activeUsers },
        alerts: { active: activeAlerts, overdue: overdueAlerts },
      },
    });
  } catch (error: any) {
    console.error('Error loading admin overview:', error);
    return NextResponse.json({ error: 'Failed to load admin overview' }, { status: 500 });
  }
}
