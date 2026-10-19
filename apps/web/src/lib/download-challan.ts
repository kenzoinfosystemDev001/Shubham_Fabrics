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
  const remarks = challan.remarks || '';
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
      background-color: #f1f5f9;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      font-size: 12px;
      line-height: 1.4;
    }
    .no-print-bar {
      max-width: 820px;
      margin: 0 auto 16px auto;
      background: #0f172a;
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
      background: #2563eb;
      color: #ffffff;
    }
    .btn-print:hover { background: #1d4ed8; }
    .btn-download {
      background: #059669;
      color: #ffffff;
    }
    .btn-download:hover { background: #047857; }

    /* CHALLAN SHEET CONTAINER */
    .challan-container {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
    }

    /* HEADER */
    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 14px;
      gap: 16px;
    }
    .company-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #a66e22;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .main-title {
      font-size: 19px;
      font-weight: 900;
      font-family: Georgia, serif;
      color: #0f172a;
      line-height: 1.2;
    }
    .sub-route-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      font-size: 11px;
      font-weight: 700;
      font-family: monospace;
      border-radius: 4px;
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
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 4px;
    }
    .barcode-text {
      font-family: monospace;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #0f172a;
    }
    .design-tag {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      margin-top: 2px;
    }

    /* SUMMARY INFO GRID */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .meta-cell {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .meta-val {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-val-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 1px;
    }

    /* FLOW AUDIT LEDGER */
    .flow-ledger {
      background: #0f172a;
      color: #ffffff;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .flow-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
      padding-bottom: 6px;
      margin-bottom: 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #fcd34d;
    }
    .flow-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .flow-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 4px;
      padding: 8px 10px;
    }
    .flow-card.defect {
      background: #450a0a;
      border-color: #991b1b;
    }
    .flow-card.out {
      background: #064e3b;
      border-color: #047857;
    }
    .flow-card-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .flow-card.defect .flow-card-label { color: #fca5a5; }
    .flow-card.out .flow-card-label { color: #86efac; }
    .flow-card-val {
      font-family: monospace;
      font-size: 16px;
      font-weight: 900;
      margin-top: 2px;
    }
    .flow-card.defect .flow-card-val { color: #fecaca; }
    .flow-card.out .flow-card-val { color: #a7f3d0; }
    .flow-card-sub {
      font-size: 9px;
      color: #cbd5e1;
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
      color: #334155;
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
      border: 1.5px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
      color: #475569;
      letter-spacing: 0.5px;
    }
    td.num {
      text-align: right;
      font-family: monospace;
      font-weight: 700;
    }
    tr.totals-row td {
      background: #f8fafc;
      font-weight: 800;
      font-size: 11px;
      border-top: 2px solid #0f172a;
    }

    /* PRODUCTION SHEET ATTACHMENT CARD */
    .sheet-ref-card {
      background: #faf5ff;
      border: 1.5px dashed #a855f7;
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
      color: #6b21a8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sheet-ref-sub {
      font-size: 10px;
      color: #4c1d95;
      margin-top: 2px;
    }

    /* REMARKS BOX */
    .remarks-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 18px;
      font-size: 11px;
    }
    .remarks-title {
      font-weight: 800;
      font-size: 10px;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 2px;
    }

    /* SIGNATURE BLOCK */
    .sign-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      padding-top: 14px;
      border-top: 1.5px solid #e2e8f0;
    }
    .sign-box {
      border-top: 1.5px dashed #64748b;
      padding-top: 8px;
      text-align: center;
    }
    .sign-title {
      font-weight: 800;
      font-size: 11px;
      color: #0f172a;
      text-transform: uppercase;
    }
    .sign-sub {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
    }

    /* FOOTER NOTICE */
    .footer-notice {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #64748b;
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
      <span style="font-size: 10px; color: #94a3b8; font-family: monospace;">
        Shubham Fabrics India Pvt. Ltd. · ${fromDept} → ${toDept}
      </span>
    </div>
    <div class="btn-group">
      <button class="btn btn-print" onclick="window.print()">
        🖨️ Print Slip
      </button>
      <button class="btn btn-download" onclick="window.downloadSelf()">
        💾 Save HTML
      </button>
    </div>
  </div>

  <div class="challan-container" id="challan-document">
    
    <!-- TOP HEADER -->
    <div class="company-header">
      <div>
        <div class="company-title">Shubham Fabrics India Pvt. Ltd.</div>
        <h1 class="main-title">${voucherTitle}</h1>
        <div class="sub-route-badge">
          ${fromDept} → ${toDept} &middot; STATUS: ${status}
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

    <!-- SUMMARY METADATA GRID -->
    <div class="meta-grid">
      <div class="meta-cell">
        <span class="meta-label">Origin (From)</span>
        <span class="meta-val">${fromLabel}</span>
        <span class="meta-val-sub">Source Department</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">Destination (To)</span>
        <span class="meta-val" style="color: #1e40af;">${toLabel}</span>
        <span class="meta-val-sub">Next Inward Gate</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">Dispatch Date</span>
        <span class="meta-val">${dateStr}</span>
        <span class="meta-val-sub">Priority: ${priority}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">Authorized Issuer</span>
        <span class="meta-val">${issuerName}</span>
        <span class="meta-val-sub" style="color: #059669;">✓ Digitally Signed</span>
      </div>
    </div>

    <!-- PROGRAM / CLIENT CONTEXT -->
    <div class="meta-grid" style="margin-top: -6px; background: #ffffff;">
      <div class="meta-cell">
        <span class="meta-label">Production Sheet #</span>
        <span class="meta-val" style="font-family: monospace;">${programSerial}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">Buyer / Customer</span>
        <span class="meta-val">${clientName}</span>
        ${canSeeClientCode && clientCode ? `<span class="meta-val-sub" style="color: #b45309; font-weight: 700;">🔒 Code: ${clientCode}</span>` : ''}
      </div>
      <div class="meta-cell">
        <span class="meta-label">Style / Pattern</span>
        <span class="meta-val">${styleCode} ${pattern !== '—' ? `(${pattern})` : ''}</span>
      </div>
      <div class="meta-cell">
        <span class="meta-label">Fabric Specification</span>
        <span class="meta-val">${fabricName}</span>
      </div>
    </div>

    <!-- FLOW AUDIT & DEFECTIVE SEGREGATION LEDGER -->
    <div class="flow-ledger">
      <div class="flow-header">
        <span>Department Flow Audit &amp; Handover Ledger</span>
        <span>Route Gate: ${fromDept} $\rightarrow$ ${toDept}</span>
      </div>
      <div class="flow-grid">
        <div class="flow-card">
          <div class="flow-card-label">1. Fabric / Pieces IN</div>
          <div class="flow-card-val">${fabricIn} <span style="font-size: 11px; font-weight: normal;">${fabricUnit}</span></div>
          <div class="flow-card-sub">Inward into ${fromDept}</div>
        </div>
        <div class="flow-card defect">
          <div class="flow-card-label">2. Defective Cut (To Shelf)</div>
          <div class="flow-card-val">${defectivePieces} <span style="font-size: 11px; font-weight: normal;">${fabricUnit}</span></div>
          <div class="flow-card-sub" title="${defectiveShelf}">${defectivePieces > 0 ? defectiveShelf : 'Zero Defects Cut'}</div>
        </div>
        <div class="flow-card out">
          <div class="flow-card-label">3. Pieces Dispatched (OUT)</div>
          <div class="flow-card-val">${fabricOut} <span style="font-size: 11px; font-weight: normal;">${fabricUnit}</span></div>
          <div class="flow-card-sub">To ${toDept} Inward</div>
        </div>
      </div>
      ${defectReason ? `
        <div style="font-size: 10px; color: #fde68a; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #475569;">
          ⚠️ Defect Segregation Note: ${defectReason}
        </div>
      ` : ''}
    </div>

    <!-- TRANSFERRED ITEMS TABLE -->
    <div class="table-container">
      <div class="table-title">
        <span>Transferred Work Items &amp; Materials (${items.length} Records)</span>
        <span style="font-family: monospace; font-size: 11px;">Total Dispatched: ${totalQuantity} ${uom}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 35px;">#</th>
            <th>Item Description</th>
            <th style="width: 140px;">Color / Shade</th>
            <th style="width: 120px;">Roll / Lot #</th>
            <th style="width: 90px; text-align: right;">Quantity</th>
            <th style="width: 60px;">UOM</th>
          </tr>
        </thead>
        <tbody>
          ${items.length > 0 ? items.map((it, idx) => `
            <tr>
              <td style="font-family: monospace; color: #64748b;">${idx + 1}</td>
              <td style="font-weight: 600;">${it.itemDescription || 'Factory Material'}</td>
              <td>${it.colour || 'Standard'}</td>
              <td style="font-family: monospace;">${it.rollNumber || it.lotNumber || '—'}</td>
              <td class="num">${it.quantity || 0}</td>
              <td>${it.uom || uom}</td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="6" style="text-align: center; color: #94a3b8; padding: 12px;">
                Standard batch lot matching Production Sheet ${programSerial}.
              </td>
            </tr>
          `}
          <tr class="totals-row">
            <td colspan="4" style="text-align: right; text-transform: uppercase; font-size: 10px;">
              Total Dispatched Handover Quantity:
            </td>
            <td class="num" style="font-size: 13px; color: #1e3a8a;">
              ${totalQuantity}
            </td>
            <td>${uom}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ACCOMPANYING PRODUCTION SHEET NOTICE -->
    <div class="sheet-ref-card">
      <div>
        <div class="sheet-ref-title">
          📋 ACCOMPANYING MASTER PRODUCTION SHEET: ${programSerial}
        </div>
        <div class="sheet-ref-sub">
          Design: <strong>${designNo}</strong> &middot; Style: <strong>${styleCode}</strong> &middot; Fabric: <strong>${fabricName}</strong>
          <br>
          Mandatory rule: This physical challan slip must be physically attached to the Master Production Sheet as it moves from department to department.
        </div>
      </div>
      <div style="font-family: monospace; font-size: 11px; font-weight: 800; color: #7e22ce;">
        TRAVELER DOC
      </div>
    </div>

    <!-- REMARKS -->
    ${remarks ? `
      <div class="remarks-box">
        <div class="remarks-title">Special Instructions / Remarks:</div>
        <p style="color: #334155; font-style: italic;">${remarks}</p>
      </div>
    ` : ''}

    <!-- DUAL PHYSICAL HANDOVER AUTHORIZATION SIGNATURES -->
    <div class="sign-grid">
      <div class="sign-box">
        <div class="sign-title">${fromLabel}</div>
        <div class="sign-sub">Authorized Dispatcher Signature (${issuerName})</div>
        <div class="sign-sub" style="margin-top: 14px;">Date: ${dateStr} &middot; Dispatched: ${totalQuantity} ${uom}</div>
      </div>
      <div class="sign-box">
        <div class="sign-title">${toLabel}</div>
        <div class="sign-sub">Receiver Gate Inward Stamp &amp; Signature</div>
        <div class="sign-sub" style="margin-top: 14px;">Date: ____________ &middot; Verified Count: ____________</div>
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
    const html = generateChallanHtml(challan);
    const challanNo = (challan.challanNumber || 'CHALLAN').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fromDept = (challan.fromDepartment || 'FROM').replace(/[^a-zA-Z0-9_-]/g, '_');
    const toDept = (challan.toDepartment || 'TO').replace(/[^a-zA-Z0-9_-]/g, '_');

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
    try {
      const html = generateChallanHtml(challan);
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      printWindow.close();
      void downloadChallanHtml(challan);
    }
  } else {
    void downloadChallanHtml(challan);
  }
}
