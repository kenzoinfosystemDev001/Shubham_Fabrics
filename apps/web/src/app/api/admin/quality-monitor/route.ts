import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { apiErrorResponse } from '@/lib/api-errors';
import {
  departmentBreakdown,
  filterOptions,
  filterRecords,
  loadMonitorRecords,
  summarize,
  type MonitorFilters,
} from '@/lib/quality-monitor-server';

export const dynamic = 'force-dynamic';

const FILTER_KEYS: Array<keyof MonitorFilters> = [
  'kind', 'from', 'to', 'department', 'qcDepartment', 'sourceDepartment', 'design', 'style', 'serial',
  'client', 'fabric', 'colour', 'status', 'unit', 'reason', 'q',
];

// GET /api/admin/quality-monitor?kind=REJECT|REWORK|HOLD&from&to&department&... — factory-wide REJECT, REWORK
// and HOLD records (administrators only). Read-only. `records` are the filtered records of `kind`; summary and
// department figures use the same filters across all three kinds; `counts` are unfiltered.
export async function GET(request: Request) {
  const { user, response } = await requireUser(request, { admin: true });
  if (!user) return response;
  try {
    const params = new URL(request.url).searchParams;
    const filters: MonitorFilters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k)]));
    const all = await loadMonitorRecords();
    const counts = { REJECT: 0, REWORK: 0, HOLD: 0 };
    for (const r of all) counts[r.kind]++;
    // Tab badges only need the counts.
    if (params.get('countsOnly') === '1') return NextResponse.json({ counts });
    const scoped = filterRecords(all, filters, { ignoreKind: true });
    const records = filters.kind ? filterRecords(scoped, { kind: filters.kind }) : scoped;
    return NextResponse.json({
      records,
      summary: summarize(scoped),
      departments: departmentBreakdown(scoped),
      counts,
      options: filterOptions(all),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiErrorResponse(error, 'Could not load the rejected, rework and hold records.', 'Quality monitor failed:');
  }
}
