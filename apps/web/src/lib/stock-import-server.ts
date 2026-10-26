import * as XLSX from 'xlsx';
import { MAX_IMPORT_ROWS, commonValue, expandMerges, rowsFromSheet } from '@/lib/stock-import-rules.mjs';

/**
 * Reads stock rows from an uploaded Excel stock sheet (.xlsx or .xls) with SheetJS. Nothing here writes
 * to the database; the import route validates the rows and adds them to Inward Stock.
 */

export interface ImportRow {
  rowNo: number;
  source: string;
  itemName: string | null;
  fabricCode: string | null;
  colour: string | null;
  dyeColour: string | null;
  quantity: number | null;
  quantityText: string | null;
  unit: 'MTR' | 'PCS' | null;
  unitText: string | null;
  supplierName: string | null;
  billNo: string | null;
  billDate: string | null;
  billDateText: string | null;
  remarks: string | null;
}

export interface ImportHeader {
  supplierName: string | null;
  billNo: string | null;
  billDate: string | null;
}

export interface ExtractionResult {
  header: ImportHeader;
  rows: ImportRow[];
  notes: string[];
}

/** The file itself is the problem (unreadable, empty, wrong columns); the user should fix the file. */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportFileError';
  }
}

const EXPECTED_COLUMNS = 'Fabric (or Item / Quality / Description) and Qty (or Meters / Pcs); optionally Colour, Unit, Fabric Code, Dyeing Colour, Supplier, Challan No., Date';

export function readExcel(bytes: Buffer): ExtractionResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, {
      type: 'buffer',
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      sheetRows: MAX_IMPORT_ROWS + 50,
    });
  } catch (error) {
    const message = String((error as Error)?.message || '');
    if (/password-protected|ECMA-376 Encrypted|EncryptionInfo|Encryption (Flags|scheme)/i.test(message)) {
      throw new ImportFileError('This Excel file is password protected. Save a copy without a password and upload that.');
    }
    throw new ImportFileError('This Excel file could not be opened. It may be damaged; open it in Excel, save it again as .xlsx and upload that.');
  }

  const rows: ImportRow[] = [];
  const notes: string[] = [];
  let sheetsWithHeader = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });
    // Merges are in sheet coordinates; the matrix starts at the top-left of the used range.
    const merges = (sheet['!merges'] || []).map((m) => ({
      s: { r: m.s.r - range.s.r, c: m.s.c - range.s.c },
      e: { r: m.e.r - range.s.r, c: m.e.c - range.s.c },
    }));
    expandMerges(matrix as unknown[][], merges);
    const read = rowsFromSheet(matrix, sheetName);
    if (read.error) continue;
    sheetsWithHeader += 1;
    notes.push(...read.notes);
    for (const row of read.rows) {
      if (rows.length >= MAX_IMPORT_ROWS) break;
      rows.push({ ...row, rowNo: rows.length + 1 } as ImportRow);
    }
  }

  if (sheetsWithHeader === 0) {
    throw new ImportFileError(`No column headings were recognised in this workbook. The first rows of a sheet should name the columns: ${EXPECTED_COLUMNS}.`);
  }
  if (rows.length === 0) throw new ImportFileError('The sheet has column headings but no stock rows under them.');

  return {
    header: { supplierName: commonValue(rows, 'supplierName'), billNo: commonValue(rows, 'billNo'), billDate: commonValue(rows, 'billDate') },
    rows,
    notes,
  };
}
