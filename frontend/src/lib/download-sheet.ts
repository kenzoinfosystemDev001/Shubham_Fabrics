/** Downloads rows as an Excel workbook (one sheet). SheetJS loads only when a download is asked for. */
export async function downloadSheet(fileName: string, sheetName: string, rows: Array<Record<string, unknown>>) {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  sheet['!cols'] = headers.map((h) => ({
    wch: Math.min(40, Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length)) + 2),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, fileName);
}
