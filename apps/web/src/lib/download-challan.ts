/**
 * Standalone Challan Downloader & Generator
 * Shubham Fabrics India Pvt. Ltd. MES
 *
 * Implements high-resolution, self-contained Challan Slip downloads (.html / printable PDF)
 * with ISO/IEC 15417 Code-128 scannable barcodes, departmental handoff tracking,
 * flow audit ledger (fabric/pieces IN, defective cut to shelf, pieces OUT),
 * items breakdown, and interdepartmental custody signatures.
 */

import { generateCode128SvgBars } from '@/lib/barcode';
import { printWhenReady } from '@/lib/print-window';
import { inchargeNameOf, userChallanRemarks } from '@/lib/challan-remarks.mjs';
import { departmentName } from '@/lib/workflow-views';
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { loadProgramDocument } from '@/lib/program-document';
import { extractRootWilcomPhoto, prepareWilcomImages } from '@/lib/download-wilcom';
import { generateProductionSheetHtml } from '@/lib/download-production-sheet';
import { garmentImageUrl, groupGarments, imageFor, isFinishedGoodsChallan } from '@/lib/finished-garments.mjs';
import { averageText, challanTotalsByUnit, formatTotals, isProgrammingToRecutting, unitOf, unitQuantityText, widthText } from '@/lib/challan-units.mjs';
import { lineSheetId, sheetBreakdown, sheetLabel } from '@/lib/challan-sheets.mjs';

/** A finished garment as printed on the challan: its name and image (a data URL, so the file works offline). */
export interface PrintedGarment {
  name: string;
  image: string | null;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface ChallanItem {
  id?: string;
  itemDescription?: string;
  colour?: string;
  quantity?: number | string;
  uom?: string;
  rollNumber?: string;
  lotNumber?: string;
  remarks?: string;
}

export function generateChallanHtml(challan: any): string {
  if (!challan) return '';

  const currentUser = typeof window !== 'undefined' ? getCurrentUser() : null;
  const canSeeClientCode = canViewClientCode(currentUser);

  const challanNo = challan.challanNumber || 'CH-0000';
  const fromDept = challan.fromDepartment || 'FABRIC_STORE';
  const toDept = challan.toDepartment || 'DYEING';
  const status = challan.status || 'ISSUED';
  const priority = challan.priority || 'NORMAL';
  const dateStr = challan.createdAt || challan.issuedDate 
    ? new Date(challan.createdAt || challan.issuedDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

  const prog = challan.program || {};
  const programSerial = prog.programSerialNo || prog.programNumber || '—';
  const designNo = prog.designNumber || prog.designName || prog.wilcomDesignNumber || 'STANDARD DESIGN';
  const clientName = prog.clientName || prog.buyerName || 'Standard Client';
  const clientCode = prog.clientCode;
  const styleCode = prog.mainStyle || prog.styleCode || '—';
  const pattern = prog.pattern || '—';
  const fabricName = prog.fabricName || '—';
  const artworkPhoto = extractRootWilcomPhoto(prog);

  // Department labels
  const deptLabels: Record<string, string> = {
    STORE: 'FABRIC STORE',
    FABRIC_STORE: 'FABRIC STORE',
    DYEING: 'DYEING DEPARTMENT',
    QC1: 'DYEING QC',
    EMBROIDERY: 'EMBROIDERY DEPARTMENT',
    THREAD_CUTTING: 'THREAD CUTTING DEPARTMENT',
    CUTTING: 'CUTTING DEPARTMENT',
    RECUTTING: 'RECUTTING DEPARTMENT',
    STITCHING: 'STITCHING DEPARTMENT',
    QC2: 'THREADCUT QC',
    WASHING: 'WASHING DEPARTMENT',
    QCWASHING: 'WASHING QC',
    QC3: 'WASHING QC',
    FINISHING: 'FINISHING DEPARTMENT',
    STEAM_PRESS: 'STEAM PRESS DEPARTMENT',
    FINAL_CHECK: 'FINAL QC',
    INVENTORY: 'INVENTORY',
    PACKING: 'PACKING & DISPATCH',
    PROGRAMMING: 'PROGRAMMING & PLANNING'
  };

  const fromLabel = deptLabels[fromDept] || fromDept;
  const toLabel = deptLabels[toDept] || toDept;

  // Specific Voucher Subtitle
  let voucherTitle = `${fromLabel} → ${toLabel}`;
  if (fromDept === 'STORE' && (toDept === 'DYEING' || toDept.includes('DYE'))) {
    voucherTitle = 'FABRIC STORE → DYEING MATERIAL DISPATCH CHALLAN';
  } else if (fromDept === 'DYEING' || toDept === 'QC1' || challanNo.startsWith('CH-DYE-')) {
    voucherTitle = 'DYEING → DYEING QC INSPECTION CHALLAN';
  } else if (fromDept === 'THREAD_CUTTING' && toDept === 'QC2') {
    voucherTitle = 'THREAD CUTTING → THREADCUT QC INSPECTION CHALLAN';
  } else if (fromDept === 'QC2' && toDept === 'WASHING') {
    voucherTitle = 'THREADCUT QC → WASHING DEPARTMENT TRANSFER CHALLAN';
  } else if (fromDept === 'WASHING' && (toDept === 'QCWASHING' || toDept === 'QC3')) {
    voucherTitle = 'WASHING → WASHING QC INSPECTION CHALLAN';
  } else if (fromDept === 'RECUTTING' && toDept === 'STITCHING') {
    voucherTitle = 'RECUTTING TO STITCHING CATEGORY / STYLE CHALLAN';
  }

  // Items
  const items: ChallanItem[] = Array.isArray(challan.items) ? challan.items : [];
  // A challan carrying several Production Sheets names each line's sheet and totals each sheet.
  const sheets = sheetBreakdown(challan);
  const sheetPrefix = (it: any) => {
    if (!sheets.multiSheet) return '';
    const id = lineSheetId(it, challan);
    return `[${sheetLabel(sheets.sheets.find((s: any) => s.programId === id)?.program)}] `;
  };
  // Store → Dyeing lines carry the colour Dyeing must achieve next to the current (base) colour.
  const hasDyeColour = items.some((i: any) => String(i.requiredColour || '').trim());
  // Programming to Recutting: Size | Average | Unit | Remarks, each of the first three a quantity with its own unit;
  // later challans: Size | Unit (of the Size) | Average | Remarks.
  const toRecuttingLayout = isProgrammingToRecutting(fromDept);
  // Each line keeps its unit: totals are per unit, never MTR + PCS.
  const unitTotals = challanTotalsByUnit(challan);
  const totalUnits = Object.keys(unitTotals);
  const singleUnit = totalUnits.length === 1 ? totalUnits[0] : null;
  const totalQtyText = singleUnit ? String(unitTotals[singleUnit]) : formatTotals(unitTotals);
  // Printed exactly as recorded; a challan with no recorded unit shows none rather than a guess.
  const uom = singleUnit || unitOf(challan.fabricUnit) || unitOf(items[0]?.uom) || '';
  const totalUnitLabel = singleUnit || '';
  // Finished garments (Finishing onward): name and image only; the Production Sheet pages follow.
  const garments: PrintedGarment[] | null = Array.isArray(challan.finishedGarments) ? challan.finishedGarments : null;
  const attachedSheets: { styles: string; html: string } | null = challan.attachedSheets || null;

  // Ledger calculation
  const defectivePieces = challan.defectivePieces ?? 0;
  const fabricUnit = unitOf(challan.defectiveUnit) || unitOf(challan.fabricUnit) || '';
  const defectiveShelf = challan.defectiveShelfLocation || 'Station Defective Shelf';
  const defectReason = challan.defectReason || '';

  // Barcode SVG
  const { svgBars, totalWidth: barW, totalHeight: barH } = generateCode128SvgBars(challanNo, 1.6, 42);

  // Issuer name
  const issuerName = challan.issuedBy?.fullName || challan.createdBy?.fullName || challan.createdBy?.username || 'Department Incharge';

  const esc = (value: unknown) => escapeHtml(String(value ?? ''));
  const fromName = departmentName(fromDept);
  const toName = departmentName(toDept);
  const totalsText = formatTotals(unitTotals) || '—';
  const sheetFields = [
    { label: 'Design No.', value: prog.designNumber || prog.designName || prog.mainStyle || '—' },
    { label: 'Serial No.', value: programSerial },
    // The issuing department's incharge (the account that issued the challan), not the client.
    { label: 'Incharge', value: inchargeNameOf(challan) || issuerName },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Challan - ${esc(challanNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #f1eff4; color: #1c1a20; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 12px; padding: 16px; }
    .no-print-bar { max-width: 186mm; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
    .btn { cursor: pointer; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid #d3ced8; background: #fff; color: #1c1a20; }
    .btn-primary { background: #7442a6; border-color: #7442a6; color: #fff; }
    .challan-container { max-width: 186mm; margin: 0 auto; background: #fff; padding: 28px; border-radius: 8px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .company { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: #57545e; }
    .title { font-size: 26px; font-weight: 800; margin-top: 2px; }
    .ref { text-align: right; }
    .ref-no { font-size: 17px; font-weight: 800; font-family: monospace; margin-top: 4px; }
    .ref-date { font-size: 12px; color: #6b6872; }
    .route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-top: 22px; padding: 12px 16px; background: #faf9fb; border: 1px solid #e4e0e8; border-radius: 8px; }
    .label { font-size: 10px; color: #6b6872; }
    .value { font-size: 14px; font-weight: 700; margin-top: 1px; overflow-wrap: anywhere; }
    .arrow { font-size: 18px; color: #7442a6; }
    .section { margin-top: 20px; }
    .section-title { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
    .fields { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #e4e0e8; border-radius: 8px; }
    .fields > div { padding: 10px 14px; border-left: 1px solid #e4e0e8; min-width: 0; }
    .fields > div:first-child { border-left: none; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e4e0e8; }
    th { background: #faf9fb; font-size: 10px; font-weight: 700; color: #57545e; text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e0e8; }
    td { padding: 9px 10px; border-bottom: 1px solid #efedf1; vertical-align: top; overflow-wrap: anywhere; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total td { background: #faf9fb; font-weight: 800; border-bottom: none; }
    .muted { color: #57545e; }
    .defect { margin-top: 10px; color: #a52e1a; font-weight: 700; }
    .garment-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .garment-card { border: 1px solid #e4e0e8; border-radius: 8px; padding: 6px; text-align: center; page-break-inside: avoid; }
    .garment-card img { width: 100%; height: 110px; object-fit: contain; }
    .no-image { height: 110px; display: flex; align-items: center; justify-content: center; color: #8f8a96; }
    .garment-name { font-size: 11px; font-weight: 700; margin-top: 4px; }
    .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px; }
    .sign { border-top: 1px solid #1c1a20; padding-top: 6px; text-align: center; }
    .sign strong { display: block; font-size: 12px; }
    .sign span { font-size: 11px; color: #6b6872; }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print-bar { display: none !important; }
      .challan-container { max-width: none; padding: 0; border-radius: 0; }
    }
  </style>
  ${attachedSheets ? `<style>${attachedSheets.styles}</style>
  <style>
    /* The challan keeps its own type over the Production Sheet's page styles, and the sheets start on a new page. */
    .challan-container { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 12px; font-weight: 400; letter-spacing: normal; line-height: 1.4; color: #1c1a20; margin-bottom: 20px; }
    .challan-page-break { break-after: page; page-break-after: always; }
  </style>` : ''}
</head>
<body>

  <div class="challan-container${attachedSheets ? ' challan-page-break' : ''}" id="challan-document">
    <div class="head">
      <div>
        <div class="company">SHUBHAM FABRICS INDIA PVT. LTD.</div>
        <div class="title">Challan</div>
      </div>
      <div class="ref">
        <svg viewBox="0 0 ${barW} ${barH}" width="170" height="40"><g>${svgBars}</g></svg>
        <div class="ref-no">${esc(challanNo)}</div>
        <div class="ref-date">${esc(dateStr)}</div>
      </div>
    </div>

    <div class="route">
      <div><div class="label">From</div><div class="value">${esc(fromName)}</div></div>
      <div class="arrow">&rarr;</div>
      <div style="text-align: right;"><div class="label">To</div><div class="value">${esc(toName)}</div></div>
    </div>

    ${challan.program ? `
    <div class="section">
      <div class="section-title">Production Sheet</div>
      <div class="fields">
        ${sheetFields.map((f) => `<div><div class="label">${f.label}</div><div class="value">${esc(f.value)}</div></div>`).join('')}
      </div>
    </div>` : ''}

    ${garments ? `
    <div class="section">
      <div class="section-title">Garments</div>
      <div class="garment-grid">
        ${garments.map((g) => `
        <div class="garment-card">
          ${g.image ? `<img src="${esc(g.image)}" alt="${esc(g.name)}">` : '<div class="no-image">No image</div>'}
          <div class="garment-name">${esc(g.name)}</div>
        </div>`).join('')}
      </div>
    </div>` : `
    <div class="section">
      <div class="section-title">Items</div>
      <table>
        <thead>
          <tr>
            <th>Fabric</th>
            <th style="width: 12%;">${hasDyeColour ? 'Base Colour' : 'Colour'}</th>
            ${hasDyeColour ? '<th style="width: 12%;">Dye Colour</th>' : ''}
            <th class="num" style="width: 12%;">Size</th>
            ${toRecuttingLayout ? '<th class="num" style="width: 11%;">Average</th>' : ''}
            <th style="width: 9%;">Unit</th>
            ${toRecuttingLayout ? '' : '<th class="num" style="width: 11%;">Average</th>'}
            <th style="width: 10%;">Width</th>
            <th style="width: 18%;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it: any) => `
          <tr>
            <td style="font-weight: 700;">${esc(sheetPrefix(it) + (it.fabricCode || it.itemDescription || '—'))}</td>
            <td>${esc(it.colour || '—')}</td>
            ${hasDyeColour ? `<td style="font-weight: 700;">${esc(it.requiredColour || '—')}</td>` : ''}
            <td class="num" style="font-weight: 700;">${esc(`${it.quantity ?? ''}${toRecuttingLayout && it.uom ? ` ${it.uom}` : ''}`)}</td>
            ${toRecuttingLayout ? `<td class="num">${esc(averageText(it))}</td>` : ''}
            <td>${esc(toRecuttingLayout ? unitQuantityText(it) : it.uom || '—')}</td>
            ${toRecuttingLayout ? '' : `<td class="num">${esc(averageText(it))}</td>`}
            <td style="font-weight: 700;">${esc(widthText(it))}</td>
            <td class="muted">${esc([it.rollNumber ? `Roll ${it.rollNumber}` : '', userChallanRemarks(it.remarks)].filter(Boolean).join(' · ') || '—')}</td>
          </tr>`).join('')}
          ${items.length === 0 ? `<tr><td colspan="${hasDyeColour ? 8 : 7}" class="muted" style="text-align: center;">No items on this challan.</td></tr>` : ''}
          ${sheets.multiSheet ? sheets.sheets.map((s: any) => `
          <tr>
            <td colspan="2">Sheet ${esc(sheetLabel(s.program))} (${s.lines.length} line${s.lines.length === 1 ? '' : 's'})</td>
            <td colspan="${hasDyeColour ? 6 : 5}">${esc(formatTotals(s.totals))}</td>
          </tr>`).join('') : ''}
          <tr class="total">
            <td colspan="2">Total</td>
            <td colspan="${hasDyeColour ? 6 : 5}">${esc(totalsText)}</td>
          </tr>
        </tbody>
      </table>
      ${defectivePieces > 0 ? `<div class="defect">Defective: ${esc(defectivePieces)} ${esc(fabricUnit)}${defectReason ? ` &mdash; ${esc(defectReason)}` : ''}</div>` : ''}
    </div>`}

    ${userChallanRemarks(challan.remarks) ? `
    <div class="section">
      <div class="section-title">Remarks</div>
      <div class="muted">${esc(userChallanRemarks(challan.remarks))}</div>
    </div>` : ''}

    <div class="signs">
      <div class="sign"><strong>Issued by</strong><span>${esc(fromName)}</span></div>
      <div class="sign"><strong>Received by</strong><span>${esc(toName)}</span></div>
    </div>
  </div>
  ${attachedSheets ? attachedSheets.html : ''}
</body>
</html>`;
}

/** An image fetched as a data URL (so a saved challan shows it offline); its address when that fails. */
async function imageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return typeof window !== 'undefined' ? new URL(url, window.location.origin).href : url;
  }
}

/** The finished garments of a challan, each once, with its image. */
async function printedGarments(challan: any): Promise<PrintedGarment[]> {
  const programId = challan.programId || challan.program?.id;
  const groups = groupGarments((challan.items || []).map((i: any) => ({ ...i, programId: i.programId || programId })));
  let images: any[] = [];
  if (programId) {
    const res = await fetch(`/api/garment-images?programIds=${encodeURIComponent(programId)}`).catch(() => null);
    const body = res && res.ok ? await res.json().catch(() => ({})) : {};
    images = body.data || [];
  }
  return Promise.all(
    groups.map(async (g) => {
      const url = garmentImageUrl(imageFor(images, g.items[0]));
      return { name: g.name, image: url ? await imageAsDataUrl(url) : null };
    }),
  );
}

/** The Production Sheet pages of the program, to print after the challan. */
function productionSheetPages(program: any): { styles: string; html: string } | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(generateProductionSheetHtml(program, 'ALL'), 'text/html');
  const html = Array.from(doc.querySelectorAll('.sheet-wrapper')).map((el) => el.outerHTML).join('\n');
  if (!html) return null;
  return { styles: Array.from(doc.querySelectorAll('style')).map((s) => s.textContent || '').join('\n'), html };
}

/**
 * The challan with everything its document shows: the full program and, for finished garments
 * (Finishing onward), each garment's name and image and the Production Sheet pages.
 */
async function completeChallanFor(challan: any) {
  const program = await prepareWilcomImages(await loadProgramDocument(challan.program || { id: challan.programId }));
  const complete = { ...challan, program };
  if (!isFinishedGoodsChallan(challan)) return complete;
  return { ...complete, finishedGarments: await printedGarments(complete), attachedSheets: productionSheetPages(program) };
}

/**
 * Downloads Challan as an offline, standalone self-contained HTML file
 */
export async function downloadChallanHtml(challan: any): Promise<void> {
  if (!challan) return;
  try {
    const completeChallan = await completeChallanFor(challan);
    const html = generateChallanHtml(completeChallan);
    const challanNo = (completeChallan.challanNumber || 'CHALLAN').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fromDept = (completeChallan.fromDepartment || 'FROM').replace(/[^a-zA-Z0-9_-]/g, '_');
    const toDept = (completeChallan.toDepartment || 'TO').replace(/[^a-zA-Z0-9_-]/g, '_');

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Challan_${challanNo}_${fromDept}_TO_${toDept}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Challan download failed.';
    window.alert(`Challan download failed: ${msg}`);
  }
}

/**
 * Opens dedicated print window for Challan slip
 */
export function printChallan(challan: any): void {
  if (!challan) return;
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    void (async () => {
      try {
        const completeChallan = await completeChallanFor(challan);
        printWindow.document.open();
        printWindow.document.write(generateChallanHtml(completeChallan));
        printWindow.document.close();
        printWhenReady(printWindow);
      } catch (error) {
        printWindow.close();
        const message = error instanceof Error ? error.message : 'Failed to print challan.';
        window.alert(`Challan print failed: ${message}`);
      }
    })();
  } else {
    void downloadChallanHtml(challan);
  }
}
