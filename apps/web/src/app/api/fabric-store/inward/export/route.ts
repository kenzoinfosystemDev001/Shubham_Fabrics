import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@subham/database';
import { requireDepartment } from '@/lib/auth/department-access';
import { apiErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COMPANY = 'Shubham Fabrics India Pvt. Ltd.';
const DAY_MS = 24 * 60 * 60 * 1000;

const HEADINGS = [
  'S.No',
  'Type',
  'Item Name',
  'Colour',
  'Bill/Ch. No',
  'Bill/Ch. Date',
  'Receiving Date',
  'Bill/Ch. Qty.',
  'Unit',
  'Price Per Unit',
  'Box/Than Qty',
  'HSN Code',
  'Tax %',
  'Party Name',
  'Biller State/City',
  'Remarks',
];
const WIDTHS = [6, 9, 32, 14, 14, 13, 14, 13, 6, 13, 12, 11, 7, 28, 20, 36];

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const showDay = (date: Date) =>
  `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`;

// Dates are stored as UTC midnight; an Excel serial keeps them the same day whatever the server's time zone.
const dateCell = (date: Date | null): XLSX.CellObject | null =>
  date ? { t: 'n', v: date.getTime() / DAY_MS + 25569, z: 'dd-mm-yyyy' } : null;

/**
 * GET /api/fabric-store/inward/export?from=YYYY-MM-DD&to=YYYY-MM-DD[&entryType=UNDYED|DYED]
 * Inward Stock received between the two dates (both included) as an .xlsx in the layout of the
 * Daily Stock Inwards Report, with separate MTR and PCS totals (units are never added together).
 */
export async function GET(request: Request) {
  const { user, response } = await requireDepartment(request, 'STORE');
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const from = parseDay(searchParams.get('from'));
  const to = parseDay(searchParams.get('to'));
  if (!from || !to) {
    return NextResponse.json({ error: 'Choose a From date and a To date.' }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: 'The From date must be on or before the To date.' }, { status: 400 });
  }

  const rawType = searchParams.get('entryType')?.toUpperCase();
  const where: any = { receivingDate: { gte: from, lt: new Date(to.getTime() + DAY_MS) } };
  if (rawType === 'UNDYED' || rawType === 'KORA') where.entryType = { in: ['UNDYED', 'KORA'] };
  else if (rawType === 'DYED') where.entryType = 'DYED';

  try {
    const entries = await prisma.fabricInward.findMany({
      where,
      orderBy: [{ receivingDate: 'asc' }, { sNo: 'asc' }],
    });

    const typeLabel = where.entryType ? (rawType === 'DYED' ? '(Dyed Fabric) ' : '(Undyed Fabric) ') : '';
    const title = `${COMPANY} Daily Stock Inwards Report ${typeLabel}From ${showDay(from)} To ${showDay(to)}`;
    const rows: unknown[][] = [[title], HEADINGS];
    const totals = { MTR: 0, PCS: 0 };
    entries.forEach((entry, index) => {
      const unit = entry.unit === 'PCS' ? 'PCS' : 'MTR';
      totals[unit] += Number(entry.billQty) || 0;
      rows.push([
        index + 1,
        entry.entryType === 'DYED' ? 'Dyed' : 'Undyed',
        entry.itemName,
        entry.colour ?? '',
        entry.billNo,
        dateCell(entry.billDate),
        dateCell(entry.receivingDate),
        entry.billQty,
        unit,
        entry.pricePerUnit ?? '',
        entry.boxThanQty ?? '',
        entry.hsnCode ?? '',
        entry.taxPercent ?? '',
        entry.supplierName ?? '',
        entry.billerStateCity ?? '',
        entry.remarks ?? '',
      ]);
    });
    if (entries.length === 0) rows.push(['', '', 'No inward entries in this period']);
    rows.push([]);
    rows.push(['', '', 'Total (MTR)', '', '', '', '', Math.round(totals.MTR * 1000) / 1000, 'MTR']);
    rows.push(['', '', 'Total (PCS)', '', '', '', '', Math.round(totals.PCS * 1000) / 1000, 'PCS']);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADINGS.length - 1 } }];
    sheet['!cols'] = WIDTHS.map((wch) => ({ wch }));
    sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: Math.max(1, entries.length + 1), c: HEADINGS.length - 1 } }) };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inward Stock');
    const file = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const fileName = `Inward_Stock_${searchParams.get('from')}_to_${searchParams.get('to')}.xlsx`;
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'The Inward Stock Excel could not be created. Try again.', 'Inward stock export failed:');
  }
}
