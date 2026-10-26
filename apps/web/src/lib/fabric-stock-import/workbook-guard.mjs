// Upload guard for Excel stock imports. Pure: inspects the bytes without decompressing them, so
// unsupported formats, encrypted workbooks and decompression bombs are refused before any parser
// runs. Used by the upload route and scripts/test-fabric-stock-import.mjs.

export const IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 4 * 1024 * 1024, // Vercel request bodies stop at 4.5 MB
  maxSheets: 10,
  maxRowsPerSheet: 2000,
  maxColumns: 50,
  maxCellsTotal: 200000,
  maxZipEntries: 2000,
  maxUncompressedBytes: 60 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxImages: 10,
  maxImageBytes: 3 * 1024 * 1024,
  parseTimeoutMs: 20000,
});

export class WorkbookRejectedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkbookRejectedError';
    this.code = code;
  }
}

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(bytes, signature) {
  return signature.every((b, i) => bytes[i] === b);
}

/** 'XLSX_ZIP' | 'OLE' | 'TEXT' | 'UNKNOWN' from the first bytes of the file. */
export function sniffFileType(bytes) {
  if (bytes.length >= 4 && startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'XLSX_ZIP';
  if (bytes.length >= 8 && startsWith(bytes, OLE_SIGNATURE)) return 'OLE';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 512)).trimStart().toLowerCase();
  if (head.startsWith('<') || head.startsWith('{') || /^[\x20-\x7e\r\n\t,;"]+$/.test(head.slice(0, 200))) return 'TEXT';
  return 'UNKNOWN';
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/**
 * Reads the ZIP central directory (no decompression).
 * @returns {Array<{ name: string, compressedSize: number, uncompressedSize: number, encrypted: boolean }>}
 */
export function readZipDirectory(bytes) {
  const min = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new WorkbookRejectedError('MALFORMED', 'The file is not a readable .xlsx workbook (damaged ZIP structure).');
  const entryCount = u16(bytes, eocd + 10);
  const dirSize = u32(bytes, eocd + 12);
  const dirOffset = u32(bytes, eocd + 16);
  if (entryCount === 0xffff || dirOffset === 0xffffffff) {
    throw new WorkbookRejectedError('MALFORMED', 'ZIP64 workbooks are not supported. Save the file again in Excel as .xlsx.');
  }
  if (dirOffset + dirSize > bytes.length) {
    throw new WorkbookRejectedError('MALFORMED', 'The file is not a readable .xlsx workbook (truncated).');
  }
  const entries = [];
  let p = dirOffset;
  for (let n = 0; n < entryCount; n++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) {
      throw new WorkbookRejectedError('MALFORMED', 'The file is not a readable .xlsx workbook (damaged directory).');
    }
    const flags = u16(bytes, p + 8);
    const compressedSize = u32(bytes, p + 20);
    const uncompressedSize = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, compressedSize, uncompressedSize, encrypted: (flags & 1) === 1 });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Accepts only a plausible, bounded .xlsx workbook. Throws WorkbookRejectedError with a message
 * written for the Fabric Store user.
 * @returns {{ entries: number, uncompressedBytes: number, worksheetParts: number, mediaParts: number }}
 */
export function inspectWorkbookBytes(bytes, limits = IMPORT_LIMITS) {
  if (!bytes || bytes.length === 0) throw new WorkbookRejectedError('EMPTY', 'The file is empty.');
  if (bytes.length > limits.maxFileBytes) {
    throw new WorkbookRejectedError(
      'TOO_LARGE',
      `The file is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is ${(limits.maxFileBytes / 1048576).toFixed(0)} MB. Split it into smaller workbooks.`,
    );
  }
  const type = sniffFileType(bytes);
  if (type === 'OLE') {
    throw new WorkbookRejectedError(
      'XLS_OR_ENCRYPTED',
      'This is an old .xls workbook or a password-protected file. Open it in Excel, remove any password and save it as .xlsx.',
    );
  }
  if (type !== 'XLSX_ZIP') {
    throw new WorkbookRejectedError('NOT_XLSX', 'Only Excel .xlsx workbooks can be imported. The file content is not an Excel workbook.');
  }
  const entries = readZipDirectory(bytes);
  if (entries.length > limits.maxZipEntries) {
    throw new WorkbookRejectedError('TOO_COMPLEX', 'The workbook has too many internal parts to import safely.');
  }
  if (entries.some((e) => e.encrypted)) {
    throw new WorkbookRejectedError('XLS_OR_ENCRYPTED', 'The workbook is encrypted. Remove the password and save it again.');
  }
  let uncompressedBytes = 0;
  for (const e of entries) {
    uncompressedBytes += e.uncompressedSize;
    if (e.uncompressedSize > 1048576 && e.uncompressedSize / Math.max(1, e.compressedSize) > limits.maxCompressionRatio) {
      throw new WorkbookRejectedError('TOO_COMPLEX', 'The workbook expands to an unsafe size and cannot be imported.');
    }
  }
  if (uncompressedBytes > limits.maxUncompressedBytes) {
    throw new WorkbookRejectedError('TOO_COMPLEX', 'The workbook expands to an unsafe size and cannot be imported.');
  }
  const names = new Set(entries.map((e) => e.name));
  if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) {
    throw new WorkbookRejectedError('NOT_XLSX', 'The file is a ZIP archive but not an Excel workbook.');
  }
  const worksheetParts = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).length;
  if (worksheetParts === 0) throw new WorkbookRejectedError('EMPTY', 'The workbook has no worksheets.');
  if (worksheetParts > limits.maxSheets) {
    throw new WorkbookRejectedError('TOO_MANY_SHEETS', `The workbook has ${worksheetParts} worksheets; the limit is ${limits.maxSheets}.`);
  }
  const mediaParts = entries.filter((e) => e.name.startsWith('xl/media/')).length;
  return { entries: entries.length, uncompressedBytes, worksheetParts, mediaParts };
}

/**
 * The uploaded file name, safe to store and display: path parts, control characters and
 * characters with meaning in headers removed. Never used to build a storage path.
 */
export function safeFileName(raw) {
  const base = String(raw || '').split(/[\\/]/).pop() || '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.normalize('NFKC').replace(/[\u0000-\u001f\u007f"<>|*?:]/g, '').trim().slice(0, 120);
  return cleaned || 'workbook.xlsx';
}
