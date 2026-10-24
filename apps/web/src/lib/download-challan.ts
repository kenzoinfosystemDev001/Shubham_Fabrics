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
import { getCurrentUser, canViewClientCode } from '@/lib/rbac';
import { loadProgramDocument } from '@/lib/program-document';
import { extractRootWilcomPhoto, prepareWilcomImages } from '@/lib/download-wilcom';

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
    QC1: 'QC1 (QUALITY CHECK 1)',
    EMBROIDERY: 'EMBROIDERY DEPARTMENT',
    THREAD_CUTTING: 'THREAD CUTTING DEPARTMENT',
    CUTTING: 'CUTTING DEPARTMENT',
    RECUTTING: 'RECUTTING WORKSTATION',
    QC2: 'QC2 (QUALITY CHECK 2)',
    WASHING: 'WASHING DEPARTMENT',
    QCWASHING: 'QC WASHING (QUALITY CHECK 3)',
    QC3: 'QC3 (QUALITY CHECK 3)',
    FINISHING: 'FINISHING DEPARTMENT',
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
    voucherTitle = 'DYEING → QC1 QUALITY INSPECTION CHALLAN';
  } else if (fromDept === 'THREAD_CUTTING' && toDept === 'QC2') {
    voucherTitle = 'THREAD CUTTING → QC2 QUALITY CHECK CHALLAN';
  } else if (fromDept === 'QC2' && toDept === 'WASHING') {
    voucherTitle = 'QC2 → WASHING DEPARTMENT TRANSFER CHALLAN';
  } else if (fromDept === 'WASHING' && (toDept === 'QCWASHING' || toDept === 'QC3')) {
    voucherTitle = 'WASHING → QC WASHING INSPECTION CHALLAN';
  }

  // Items
  const items: ChallanItem[] = Array.isArray(challan.items) ? challan.items : [];
  const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const uom = items[0]?.uom || 'PCS';

  // Ledger calculation
  const fabricIn = challan.fabricIn ?? (challan.parentChallan?.fabricOut || totalQuantity);
  const fabricOut = challan.fabricOut ?? totalQuantity;
  const defectivePieces = challan.defectivePieces ?? 0;
  const fabricUnit = challan.fabricUnit || uom;
  const defectiveShelf = challan.defectiveShelfLocation || 'Station Defective Shelf';
  const defectReason = challan.defectReason || '';

  // Barcode SVG
  const { svgBars, totalWidth: barW, totalHeight: barH } = generateCode128SvgBars(challanNo, 1.6, 42);

  // Issuer name
  const issuerName = challan.issuedBy?.fullName || challan.createdBy?.fullName || challan.createdBy?.username || 'Department Incharge';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Challan - ${challanNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      background-color: #f1eff4;
      color: #25232a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      font-size: 12px;
      line-height: 1.4;
    }
    .no-print-bar {
      max-width: 820px;
      margin: 0 auto 16px auto;
      background: #25232a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .no-print-bar h3 {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .btn-group {
      display: flex;
      gap: 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      text-decoration: none;
      transition: background 0.15s;
    }
    .btn-print {
      background: #8e55c4;
      color: #ffffff;
    }
    .btn-print:hover { background: #7442a6; }
    .btn-download {
      background: #ffffff;
      color: #7442a6;
      border: 1px solid #8e55c4;
    }
    .btn-download:hover { background: #f7f1fc; }

    /* CHALLAN SHEET CONTAINER */
    .challan-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #000000;
      padding: 20px;
    }

    /* HEADER */
    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 12px;
      gap: 16px;
    }
    .company-title {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #000000;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .main-title {
      font-size: 18px;
      font-weight: 900;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    .sub-route-badge {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 6px;
      background: #f1eff4;
      border: 1px solid #d3ced8;
      color: #000000;
      font-size: 10px;
      font-weight: 800;
      font-family: monospace;
      border-radius: 3px;
    }

    /* BARCODE SECTION */
    .barcode-box {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .barcode-svg-wrap {
      background: #ffffff;
      padding: 4px;
      border: 1px solid #d3ced8;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .barcode-text {
      font-family: monospace;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #25232a;
    }
    .design-tag {
      font-size: 10px;
      font-weight: 700;
      color: #57545e;
      margin-top: 2px;
    }

    /* SUMMARY INFO GRID */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8f7fa;
      border: 1.5px solid #000000;
      padding: 8px 12px;
      margin-bottom: 8px;
    }
    .meta-cell {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      color: #57545e;
      letter-spacing: 0.5px;
      margin-bottom: 1px;
    }
    .meta-val {
      font-size: 11px;
      font-weight: 800;
      color: #000000;
    }

    /* FLOW AUDIT LEDGER */
    .flow-ledger {
      background: #ffffff;
      color: #000000;
      border: 1.5px solid #000000;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .flow-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #000000;
      padding-bottom: 6px;
      margin-bottom: 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #000000;
    }
    .flow-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .flow-card {
      background: #ffffff;
      border: 1px solid #6b6872;
      border-radius: 4px;
      padding: 8px 10px;
    }
    .flow-card.defect {
      background: #ffffff;
      border: 2px dashed #c93a22;
    }
    .flow-card.out {
      background: #ffffff;
      border: 2px solid #000000;
    }
    .flow-card-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #43404a;
    }
    .flow-card.defect .flow-card-label { color: #a52e1a; }
    .flow-card.out .flow-card-label { color: #000000; }
    .flow-card-val {
      font-family: monospace;
      font-size: 16px;
      font-weight: 900;
      margin-top: 2px;
    }
    .flow-card.defect .flow-card-val { color: #a52e1a; }
    .flow-card.out .flow-card-val { color: #000000; }
    .flow-card-sub {
      font-size: 9px;
      color: #43404a;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ITEMS TABLE */
    .table-container {
      margin-bottom: 14px;
    }
    .table-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #43404a;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1.5px solid #d3ced8;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #f1eff4;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
      color: #57545e;
      letter-spacing: 0.5px;
    }
    td.num {
      text-align: right;
      font-family: monospace;
      font-weight: 700;
    }
    tr.totals-row td {
      background: #f8f7fa;
      font-weight: 800;
      font-size: 11px;
      border-top: 2px solid #25232a;
    }

    /* PRODUCTION SHEET ATTACHMENT CARD */
    .sheet-ref-card {
      background: #ffffff;
      border: 1.5px dashed #000000;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sheet-ref-title {
      font-size: 11px;
      font-weight: 800;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sheet-ref-sub {
      font-size: 10px;
      color: #000000;
      margin-top: 2px;
    }


    /* SIGNATURE BLOCK */
    .sign-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      padding-top: 14px;
      border-top: 1.5px solid #e5e1e8;
    }
    .sign-box {
      border-top: 1.5px dashed #6b6872;
      padding-top: 8px;
      text-align: center;
    }
    .sign-title {
      font-weight: 800;
      font-size: 11px;
      color: #25232a;
      text-transform: uppercase;
    }
    .sign-sub {
      font-size: 9px;
      color: #6b6872;
      margin-top: 2px;
    }

    /* FOOTER NOTICE */
    .footer-notice {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #e5e1e8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #6b6872;
      font-family: monospace;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print-bar {
        display: none !important;
      }
      .challan-container {
        border: 2px solid #000000;
        box-shadow: none;
        padding: 12px;
        margin: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

  <!-- Screen Navigation / Download Controls -->
  <div class="no-print-bar">
    <div>
      <h3>MATERIAL DISPATCH CHALLAN · ${challanNo}</h3>
      <span style="font-size: 10px; color: #8f8a96; font-family: monospace;">
        Shubham Fabrics India Pvt. Ltd. · ${fromDept} → ${toDept}
      </span>
    </div>
    <div class="btn-group">
      <button class="btn btn-print" onclick="window.print()">
        Print Slip
      </button>
      <button class="btn btn-download" onclick="window.downloadSelf()">
        Save HTML
      </button>
    </div>
  </div>

  <div class="challan-container" id="challan-document">
    
    <!-- TOP HEADER -->
    <div class="company-header">
      <div>
        <div class="company-title">SHUBHAM FABRICS INDIA PVT. LTD.</div>
        <h1 class="main-title">DEPARTMENT TRANSFER CHALLAN</h1>
        <div class="sub-route-badge">
          ${fromLabel} &rarr; ${toLabel}
        </div>
      </div>

      <div class="barcode-box">
        <div class="barcode-svg-wrap">
          <svg viewBox="0 0 ${barW} ${barH}" width="160" height="38">
            <g>${svgBars}</g>
          </svg>
        </div>
        <div class="barcode-text">${challanNo}</div>
        <div class="design-tag">DESIGN: ${designNo}</div>
      </div>
    </div>

    <!-- METADATA FORM GRID -->
    <div class="meta-grid">
      <div class="meta-cell">
        <span class="meta-label">CHALLAN NO</span>
        <span class="meta-val font-mono">${challanNo}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">DISPATCH DATE</span>
        <span class="meta-val">${dateStr}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">FROM STATION</span>
        <span class="meta-val">${fromLabel}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">TO STATION</span>
        <span class="meta-val">${toLabel}</span>
      </div>
    </div>

    <!-- PROGRAM / ORDER DETAILS (ONLY ACTUAL FILLED DETAILS) -->
    <div class="meta-grid" style="margin-top: -4px;">
      <div class="meta-cell">
        <span class="meta-label">PRODUCTION SHEET #</span>
        <span class="meta-val font-mono">${programSerial}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">DESIGN NO</span>
        <span class="meta-val font-mono">${designNo}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">STYLE / PATTERN</span>
        <span class="meta-val">${styleCode}${pattern && pattern !== '—' ? ` (${pattern})` : ''}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">FABRIC</span>
        <span class="meta-val">${fabricName}</span>
      </div>
    </div>

    ${artworkPhoto ? `
    <div style="display:flex;align-items:center;gap:12px;border:1px solid #111;padding:6px;margin-top:6px;">
      <strong style="font-size:9px;text-transform:uppercase;">Wilcom Artwork Reference</strong>
      <img src="${artworkPhoto}" alt="Wilcom artwork for design ${designNo}" style="max-height:72px;max-width:180px;object-fit:contain;">
    </div>
    ` : ''}

    ${clientName && clientName !== 'Standard Client' ? `
    <div class="meta-grid" style="margin-top: -4px;">
      <div class="meta-cell" style="grid-column: span 2;">
        <span class="meta-label">BUYER / CLIENT</span>
        <span class="meta-val">${clientName}${canSeeClientCode && clientCode ? ` (Code: ${clientCode})` : ''}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">PRIORITY</span>
        <span class="meta-val">${priority}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">STATUS</span>
        <span class="meta-val">${status}</span>
      </div>
    </div>
    ` : ''}

    ${defectivePieces > 0 ? `
    <div style="border: 1.5px solid #a52e1a; background: #fff4f2; padding: 8px 12px; margin-bottom: 10px; border-radius: 4px; font-size: 11px; font-weight: bold; color: #a52e1a;">
      DEFECTIVE CUT (TO SHELF): ${defectivePieces} ${fabricUnit} [Location: ${defectiveShelf}]${defectReason ? ` &middot; Reason: ${defectReason}` : ''}
    </div>
    ` : ''}

    <!-- TRANSFERRED ITEMS TABLE -->
    <div class="table-container">
      <div class="table-title">
        <span>ITEMS / MATERIALS</span>
        <span style="font-family: monospace; font-size: 11px;">Total: ${totalQuantity || challan.fabricOut || challan.fabricIn || 0} ${uom}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>ITEM DESCRIPTION</th>
            <th style="width: 140px;">COLOR / SHADE</th>
            <th style="width: 120px;">ROLL / LOT #</th>
            <th style="width: 90px; text-align: right;">QUANTITY</th>
            <th style="width: 60px; text-align: center;">UOM</th>
          </tr>
        </thead>
        <tbody>
          ${items.length > 0 ? items.map((it, idx) => `
            <tr>
              <td style="text-align: center; font-family: monospace;">${idx + 1}</td>
              <td style="font-weight: 700;">${it.itemDescription || fabricName || styleCode || 'Fabric Lot'}</td>
              <td>${it.colour || prog.fabricColor || 'Standard'}</td>
              <td style="font-family: monospace;">${it.rollNumber || it.lotNumber || '—'}</td>
              <td class="num">${it.quantity || 0}</td>
              <td style="text-align: center;">${it.uom || uom}</td>
            </tr>
          `).join('') : `
            <tr>
              <td style="text-align: center; font-family: monospace;">1</td>
              <td style="font-weight: 700;">${fabricName || styleCode || 'Production Material'}</td>
              <td>${prog.fabricColor || 'Standard'}</td>
              <td style="font-family: monospace;">—</td>
              <td class="num">${totalQuantity || challan.fabricOut || challan.fabricIn || 0}</td>
              <td style="text-align: center;">${uom}</td>
            </tr>
          `}
          <tr class="totals-row">
            <td colspan="4" style="text-align: right; text-transform: uppercase; font-size: 10px; font-weight: 900;">
              TOTAL QUANTITY:
            </td>
            <td class="num" style="font-size: 13px; font-weight: 900;">
              ${totalQuantity || challan.fabricOut || challan.fabricIn || 0}
            </td>
            <td style="text-align: center; font-weight: 900;">${uom}</td>
          </tr>
        </tbody>
      </table>
    </div>


    <!-- DUAL PHYSICAL HANDOVER AUTHORIZATION SIGNATURES -->
    <div class="sign-grid">
      <div class="sign-box">
        <div class="sign-title">DISPATCHED BY</div>
        <div class="sign-sub">${issuerName} (${fromLabel})</div>
        <div class="sign-sub" style="margin-top: 24px; font-weight: 700;">Signature: _______________________</div>
      </div>
      <div class="sign-box">
        <div class="sign-title">RECEIVED BY</div>
        <div class="sign-sub">Station Incharge (${toLabel})</div>
        <div class="sign-sub" style="margin-top: 24px; font-weight: 700;">Signature: _______________________</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer-notice">
      <span>SHUBHAM FABRICS INDIA PVT. LTD. &middot; MES SHOP-FLOOR LOGISTICS</span>
      <span>CHALLAN ID: ${challan.id || challanNo} &middot; PAGE 1 OF 1</span>
    </div>

  </div>

  <script>
    window.downloadSelf = function() {
      var blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = "Challan_${challanNo}_${fromDept}_TO_${toDept}.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    };
  </script>
</body>
</html>`;
}

/**
 * Downloads Challan as an offline, standalone self-contained HTML file
 */
export async function downloadChallanHtml(challan: any): Promise<void> {
  if (!challan) return;
  try {
    const completeChallan = {
      ...challan,
      program: await prepareWilcomImages(await loadProgramDocument(challan.program || { id: challan.programId })),
    };
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
        const completeChallan = {
          ...challan,
          program: await prepareWilcomImages(await loadProgramDocument(challan.program || { id: challan.programId })),
        };
        printWindow.document.open();
        printWindow.document.write(generateChallanHtml(completeChallan));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
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
