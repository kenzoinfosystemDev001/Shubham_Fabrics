/**
 * Production Sheet Generator & Downloader
 * Shubham Fabrics India Pvt. Ltd. MES - Programming Department
 */

export function generateProductionSheetHtml(program: any): string {
  const serialNo = program.programSerialNo || program.programNumber || 'PRG-DRAFT';
  const clientName = program.clientName || program.buyerName || '—';
  const designNo = program.designNumber || program.designName || '—';
  const wilcomNo = program.wilcomDesignNumber || '—';
  const mainStyle = program.mainStyle || program.styleCode || '—';
  const subStyle = program.subStyle || '—';
  const pattern = program.pattern || '—';
  const baseDesignType = program.baseDesignType || '—';
  const embroideryDesign = program.embroideryDesign || program.designName || '—';
  const embroiderySize = program.embroideryDesignSize || '—';
  const fabricName = program.fabricName || program.fabrics?.[0]?.fabricName || '—';
  const fabricType = program.fabricType || program.fabrics?.[0]?.composition || '—';
  const fabricWidth = program.fabricWidth || (program.fabricWidthInches ? `${program.fabricWidthInches} Inches` : '—');
  const fabricColor = program.fabricColor || program.colours?.[0]?.colorName || '—';
  const fabricColorAvailable = program.fabricColorAvailable || 'IN_STOCK';
  const fabricAverage = program.fabricAverage || '—';
  const fabricAverageType = program.fabricAverageType || 'Meters/Piece';
  const fabricAverageMeasurement = program.fabricAverageMeasurement || 'Standard';
  const fabricDyeingRequired = program.fabricDyeingRequired ? 'YES' : 'NO';
  const fabricIssuedToDyeing = program.fabricIssuedToDyeing || 0;
  const fabricSentToDyeing = program.fabricSentToDyeing || 0;
  const colorQty = program.colorQuantity || program.targetQuantity || 0;
  const qtyUnit = program.quantityMeasurement || 'PCS';
  const specialMaterial = program.specialMaterial || 'None';
  const specialMaterialQty = program.specialMaterialQuantity || '—';
  const prodDesignDate = program.productionDesignDate ? new Date(program.productionDesignDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const prodEndDate = program.productionEndDate ? new Date(program.productionEndDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const deliveryDate = program.deliveryDate ? new Date(program.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const startDate = program.startDate || program.programDate ? new Date(program.startDate || program.programDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const piecesRejection = program.piecesRejection || 0;
  const rejectionReason = program.rejectionReason || '—';
  const comments = program.comments || program.remarks || 'No special remarks entered.';
  const authorName = program.createdBy?.fullName || 'Programming Incharge';
  const printDate = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  // Simple SVG Barcode simulation for the program serial number
  const barcodeLines = Array.from({ length: 42 })
    .map((_, i) => {
      const width = (i * 7 + serialNo.length) % 3 === 0 ? 3 : (i % 2 === 0 ? 1.5 : 2);
      const x = 15 + i * 5;
      return `<rect x="${x}" y="5" width="${width}" height="32" fill="#111827" />`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Production Sheet - ${serialNo} - Shubham Fabrics</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      background-color: #f3f4f6;
      color: #111827;
      font-size: 11px;
      line-height: 1.4;
      padding: 20px;
    }
    .sheet-container {
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 12mm 14mm;
      border: 1px solid #d1d5db;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    .no-print-bar {
      max-width: 210mm;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 6px;
    }
    .btn {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      border: none;
      transition: background 0.15s;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-outline {
      background: #334155;
      color: #ffffff;
    }
    .btn-outline:hover {
      background: #475569;
    }

    /* SHEET HEADER */
    .sheet-header {
      border-bottom: 2px solid #163767;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-title {
      font-size: 18px;
      font-weight: 800;
      color: #163767;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 9px;
      color: #64748b;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      font-weight: 700;
      margin-top: 1px;
    }
    .doc-badge {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .header-meta {
      text-align: right;
    }
    .prog-number {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 16px;
      font-weight: 800;
      color: #163767;
    }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      background: #dbeafe;
      color: #1e40af;
      margin-top: 3px;
    }

    /* SECTIONS */
    .section-title {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #163767;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #163767;
      margin-top: 8px;
      margin-bottom: 4px;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
    }
    .spec-table th, .spec-table td {
      border: 1px solid #e2e8f0;
      padding: 4px 8px;
      text-align: left;
      vertical-align: top;
    }
    .spec-table th {
      background: #f1f5f9;
      color: #475569;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.03em;
      width: 25%;
    }
    .spec-table td {
      color: #0f172a;
      font-size: 10px;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
    }
    .highlight-cell {
      background: #f8fafc;
      font-weight: 700;
      color: #163767;
    }

    /* TWO-COLUMN GRID */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    /* SIGNATURE BLOCK */
    .sign-section {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
    }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 6px;
    }
    .sign-box {
      border: 1px solid #cbd5e1;
      background: #fafafa;
      border-radius: 4px;
      padding: 6px;
      height: 60px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sign-role {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
    }
    .sign-line {
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px dotted #94a3b8;
      padding-top: 2px;
    }

    /* FOOTER */
    .sheet-footer {
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5px;
      color: #64748b;
    }

    /* PRINT SPECIFIC */
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .no-print-bar {
        display: none !important;
      }
      .sheet-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

  <!-- Top Action Bar for interactive browser preview -->
  <div class="no-print-bar">
    <div>
      <strong>Shubham Fabrics MES</strong> &middot; Production Sheet ${serialNo}
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" onclick="window.print()">
        🖨️ Print Sheet (A4)
      </button>
      <button class="btn btn-outline" onclick="window.close()">
        ✕ Close
      </button>
    </div>
  </div>

  <div class="sheet-container">
    
    <!-- HEADER -->
    <div class="sheet-header">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="/shubham-logo.jpg" alt="Logo" style="height: 52px; width: auto; object-fit: contain; border-radius: 4px;" />
        <div>
          <div class="company-title">SHUBHAM FABRICS INDIA PVT. LTD.</div>
          <div class="company-sub">Manufacturing Execution System &middot; Production Sheet</div>
          <div class="doc-badge">Department: Programming &middot; Factory Traveler Card</div>
        </div>
      </div>
      <div class="header-meta">
        <div class="prog-number">${serialNo}</div>
        <div><span class="status-pill">${program.status || 'DRAFT'}</span></div>
        <div style="margin-top: 4px;">
          <svg width="220" height="36" viewBox="0 0 240 40">
            ${barcodeLines}
          </svg>
        </div>
      </div>
    </div>

    <!-- SECTION 1 & 2: ORDER & STYLE -->
    <div class="grid-2">
      <div>
        <div class="section-title">Section 1 · Order &amp; Commercial Info</div>
        <table class="spec-table">
          <tr>
            <th>Program Serial #</th>
            <td class="font-mono highlight-cell">${serialNo}</td>
          </tr>
          <tr>
            <th>Client / Buyer</th>
            <td style="font-weight: 700;">${clientName}</td>
          </tr>
          <tr>
            <th>Design Number</th>
            <td class="font-mono">${designNo}</td>
          </tr>
          <tr>
            <th>Client Priority</th>
            <td><strong style="color: ${program.clientPriority === 'HIGH' || program.clientPriority === 'URGENT' ? '#b91c1c' : '#1e3a8a'};">${program.clientPriority || 'NORMAL'}</strong></td>
          </tr>
          <tr>
            <th>Target Delivery Date</th>
            <td class="font-mono" style="font-weight: 700;">${deliveryDate}</td>
          </tr>
          <tr>
            <th>Program Start Date</th>
            <td>${startDate}</td>
          </tr>
        </table>
      </div>

      <div>
        <div class="section-title">Section 2 · Style Specifications</div>
        <table class="spec-table">
          <tr>
            <th>Main Style</th>
            <td style="font-weight: 700;">${mainStyle}</td>
          </tr>
          <tr>
            <th>Sub Style</th>
            <td>${subStyle}</td>
          </tr>
          <tr>
            <th>Pattern / Cut</th>
            <td>${pattern}</td>
          </tr>
          <tr>
            <th>Base Design Type</th>
            <td>${baseDesignType}</td>
          </tr>
          <tr>
            <th>Product Category</th>
            <td>${program.productCategory || 'GARMENT'}</td>
          </tr>
          <tr>
            <th>Order Ref #</th>
            <td class="font-mono">${program.orderNumber || '—'}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- SECTION 3: WILCOM & EMBROIDERY -->
    <div class="section-title">Section 3 · Wilcom &amp; Technical Embroidery Parameters</div>
    <table class="spec-table">
      <tr>
        <th style="width: 20%;">Wilcom Design #</th>
        <td style="width: 30%;" class="font-mono highlight-cell">${wilcomNo}</td>
        <th style="width: 20%;">Embroidery Size / Frame</th>
        <td style="width: 30%;" class="font-mono">${embroiderySize}</td>
      </tr>
      <tr>
        <th>Embroidery Description</th>
        <td colspan="3" style="font-weight: 600;">${embroideryDesign}</td>
      </tr>
      ${program.wilcomDesignPhoto || program.baseDesignPhoto ? `
      <tr>
        <th>Design Attachments</th>
        <td colspan="3" style="padding: 6px;">
          <div style="display: flex; gap: 12px; align-items: center;">
            ${program.baseDesignPhoto ? `<div><span style="font-size: 8px; font-weight: bold; display: block; color: #64748b;">BASE DESIGN:</span><img src="${program.baseDesignPhoto}" style="max-height: 90px; max-width: 140px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 4px;" /></div>` : ''}
            ${program.wilcomDesignPhoto ? `<div><span style="font-size: 8px; font-weight: bold; display: block; color: #64748b;">WILCOM TECHNICAL:</span><img src="${program.wilcomDesignPhoto}" style="max-height: 90px; max-width: 140px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 4px;" /></div>` : ''}
          </div>
        </td>
      </tr>` : ''}
    </table>

    <!-- SECTION 4 & 5: FABRIC & DYEING -->
    <div class="grid-2">
      <div>
        <div class="section-title">Section 4 · Fabric Master Details</div>
        <table class="spec-table">
          <tr>
            <th>Fabric Name / Quality</th>
            <td style="font-weight: 700;">${fabricName}</td>
          </tr>
          <tr>
            <th>Fabric Composition</th>
            <td>${fabricType}</td>
          </tr>
          <tr>
            <th>Fabric Width</th>
            <td class="font-mono">${fabricWidth}</td>
          </tr>
          <tr>
            <th>Fabric Color / Shade</th>
            <td style="font-weight: 700;">${fabricColor}</td>
          </tr>
          <tr>
            <th>Color Stock Status</th>
            <td>${fabricColorAvailable}</td>
          </tr>
          <tr>
            <th>Fabric Avg Consumption</th>
            <td class="font-mono"><strong>${fabricAverage}</strong> ${fabricAverageType}</td>
          </tr>
          <tr>
            <th>Avg Measurement Basis</th>
            <td>${fabricAverageMeasurement}</td>
          </tr>
        </table>
      </div>

      <div>
        <div class="section-title">Section 5 · Dyeing &amp; Processing</div>
        <table class="spec-table">
          <tr>
            <th>Dyeing Required</th>
            <td><strong style="color: ${fabricDyeingRequired === 'YES' ? '#0369a1' : '#475569'};">${fabricDyeingRequired}</strong></td>
          </tr>
          <tr>
            <th>Fabric Issued to Dyeing</th>
            <td class="font-mono">${fabricIssuedToDyeing} Mtr</td>
          </tr>
          <tr>
            <th>Fabric Sent to Dyeing</th>
            <td class="font-mono">${fabricSentToDyeing} Mtr</td>
          </tr>
          <tr>
            <th>Total Color Quantity</th>
            <td class="font-mono highlight-cell">${colorQty} ${qtyUnit}</td>
          </tr>
          <tr>
            <th>Special Material / Thread</th>
            <td>${specialMaterial}</td>
          </tr>
          <tr>
            <th>Special Material Qty</th>
            <td>${specialMaterialQty}</td>
          </tr>
          <tr>
            <th>Rejection Tolerance</th>
            <td class="font-mono" style="color: #b91c1c; font-weight: 700;">${piecesRejection} PCS</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- SECTION 7 & 8: SCHEDULE & COMMENTS -->
    <div class="section-title">Sections 7 &amp; 8 · Schedule, Quality &amp; Operator Notes</div>
    <table class="spec-table">
      <tr>
        <th style="width: 20%;">Design Release Date</th>
        <td style="width: 30%;">${prodDesignDate}</td>
        <th style="width: 20%;">Projected Floor End Date</th>
        <td style="width: 30%;">${prodEndDate}</td>
      </tr>
      <tr>
        <th>Rejection Reason / Notes</th>
        <td colspan="3">${rejectionReason}</td>
      </tr>
      <tr>
        <th>Technical Comments &amp; Instructions</th>
        <td colspan="3" style="font-style: italic; background: #fffbeb; padding: 6px 8px;">
          ${comments}
        </td>
      </tr>
    </table>

    <!-- SIGNATURE AUTHORIZATIONS -->
    <div class="sign-section">
      <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #163767;">
        Department Sign-off &amp; Material Movement Authorization
      </div>
      <div class="sign-grid">
        <div class="sign-box">
          <div class="sign-role">1. Prepared By (Programming)</div>
          <div style="font-size: 9px; font-weight: 600; color: #1e293b;">${authorName}</div>
          <div class="sign-line">Signature &amp; Date</div>
        </div>
        <div class="sign-box">
          <div class="sign-role">2. Fabric Store Incharge</div>
          <div style="font-size: 8px; color: #64748b;">Rolls Issued / Verified</div>
          <div class="sign-line">Signature &amp; Date</div>
        </div>
        <div class="sign-box">
          <div class="sign-role">3. Floor Master / Embroidery</div>
          <div style="font-size: 8px; color: #64748b;">Job Received on Machine</div>
          <div class="sign-line">Signature &amp; Date</div>
        </div>
        <div class="sign-box">
          <div class="sign-role">4. QA / Factory Manager</div>
          <div style="font-size: 8px; color: #64748b;">Final Clearance</div>
          <div class="sign-line">Signature &amp; Date</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="sheet-footer">
      <div>Shubham Fabrics India Pvt. Ltd. &middot; Programming Department MES Traveler Sheet</div>
      <div>Printed: ${printDate} &middot; Confidential Factory Floor Document</div>
    </div>

  </div>

</body>
</html>`;
}

/**
 * Download Production Sheet as an offline HTML file
 */
export function downloadProductionSheetHtml(program: any) {
  const html = generateProductionSheetHtml(program);
  const serialNo = program.programSerialNo || program.programNumber || 'PRG-SHEET';
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Production_Sheet_${serialNo}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open print window for the Production Sheet
 */
export function printProductionSheet(program: any) {
  const html = generateProductionSheetHtml(program);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // Allow styles to render before triggering print
    setTimeout(() => {
      printWindow.print();
    }, 350);
  } else {
    // If pop-up is blocked, fallback to downloading
    downloadProductionSheetHtml(program);
  }
}
