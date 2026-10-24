import { NextResponse } from 'next/server';
import { prisma } from '@subham/database';
import { requireAdmin } from '@/lib/admin-auth';
import { CANCELLED_CHALLAN_STATUSES, COMPLETED_CHALLAN_STATUSES } from '@/lib/admin-metrics';
import { MES_DEPARTMENTS } from '@/lib/departments';

export const dynamic = 'force-dynamic';

const CLOSED = [...COMPLETED_CHALLAN_STATUSES, ...CANCELLED_CHALLAN_STATUSES];

// GET /api/admin/departments — the 15 approved departments with live workload figures.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.actor) return auth.response;
  try {
    const codes = MES_DEPARTMENTS.map((d) => d.code);
    const [rows, users, incoming, outgoing, sheetLinks, alerts] = await Promise.all([
      prisma.department.findMany({
        where: { code: { in: codes } },
        select: { code: true, name: true, isActive: true, updatedAt: true, incharge: { select: { id: true, fullName: true, username: true, isActive: true } } },
      }),
      prisma.user.findMany({
        where: { departmentCode: { in: codes } },
        select: { id: true, fullName: true, username: true, isActive: true, departmentCode: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.challan.groupBy({ by: ['toDepartment'], where: { toDepartment: { in: codes }, status: { notIn: CLOSED } }, _count: { _all: true } }),
      prisma.challan.groupBy({ by: ['fromDepartment'], where: { fromDepartment: { in: codes }, status: { notIn: CLOSED } }, _count: { _all: true } }),
      prisma.challan.findMany({
        where: { OR: [{ toDepartment: { in: codes } }, { fromDepartment: { in: codes } }] },
        select: { fromDepartment: true, toDepartment: true, programId: true },
        distinct: ['fromDepartment', 'toDepartment', 'programId'],
      }),
      prisma.deadlineAlert.groupBy({ by: ['departmentCode'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
    ]);

    const sheetsByDept = new Map<string, Set<string>>();
    for (const link of sheetLinks) {
      for (const code of [link.fromDepartment, link.toDepartment]) {
        if (!sheetsByDept.has(code)) sheetsByDept.set(code, new Set());
        sheetsByDept.get(code)!.add(link.programId);
      }
    }

    const data = MES_DEPARTMENTS.map((dept, index) => {
      const row = rows.find((r) => r.code === dept.code);
      return {
        code: dept.code,
        sequence: index + 1,
        approvedName: dept.name,
        name: row?.name || dept.name,
        isQc: dept.isQc,
        // Departments that have never been stored are active by default.
        isActive: row ? row.isActive : true,
        hasRecord: Boolean(row),
        incharge: row?.incharge || null,
        users: users.filter((u) => u.departmentCode === dept.code),
        incomingOpen: incoming.find((r) => r.toDepartment === dept.code)?._count._all || 0,
        outgoingOpen: outgoing.find((r) => r.fromDepartment === dept.code)?._count._all || 0,
        productionSheets: sheetsByDept.get(dept.code)?.size || 0,
        activeAlerts: alerts.find((r) => r.departmentCode === dept.code)?._count._all || 0,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error loading departments:', error);
    return NextResponse.json({ error: 'Failed to load departments' }, { status: 500 });
  }
}
