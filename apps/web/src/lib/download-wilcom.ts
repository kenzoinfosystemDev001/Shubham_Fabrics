/**
 * Wilcom Embroidery Specification Form Module
 * Dedicated module for Wilcom types, HTML generation, printing, and downloading.
 * Keeps Wilcom logic cleanly separated from Production Sheets and Challans.
 */

export type GarmentCategory = 'TOP' | 'BOTTOM' | 'DUPATTA' | 'OTHER';

export interface WilcomEntry {
  id: string;
  category: GarmentCategory;
  styleName: string;
  wilcomDesignNumber: string;
  photoUrl?: string;
  remarks?: string;
  createdAt?: string;
}

/**
 * Converts image source into a base64 Data URL to guarantee offline rendering and printing.
 */
async function embedImage(source: string, label: string): Promise<string> {
  if (!source) return '';
  if (source.startsWith('data:image/')) return source;

  try {
    const imageUrl = new URL(source, typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000');
    const response = await fetch(imageUrl, { credentials: 'omit' });
    if (!response.ok) return source;

    const image = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else resolve(source);
      };
      reader.onerror = () => resolve(source);
      reader.readAsDataURL(image);
    });
  } catch {
    return source;
  }
}

/**
 * Prepares all Wilcom images as embedded base64 data URLs for offline export and print
 */
export async function prepareWilcomImages(program: any) {
  const preparedProgram = { ...program };
  if (preparedProgram.baseDesignPhoto) {
    preparedProgram.baseDesignPhoto = await embedImage(preparedProgram.baseDesignPhoto, 'Base design photo');
  }
  if (preparedProgram.wilcomDesignPhoto) {
    preparedProgram.wilcomDesignPhoto = await embedImage(preparedProgram.wilcomDesignPhoto, 'Wilcom design photo');
  }

  try {
    let meta: any = null;
    if (preparedProgram.metadataJson) {
      meta = typeof preparedProgram.metadataJson === 'string'
        ? JSON.parse(preparedProgram.metadataJson)
        : { ...preparedProgram.metadataJson };
    }

    const fallbackPhoto = preparedProgram.wilcomDesignPhoto || meta?.wilcomDesignPhoto || preparedProgram.baseDesignPhoto || '';

    let entries: WilcomEntry[] = Array.isArray(meta?.wilcomEntries) ? meta.wilcomEntries : [];
    if (entries.length === 0 && (preparedProgram.wilcomDesignNumber || fallbackPhoto || preparedProgram.embroideryDesign)) {
      entries = [
        {
          id: 'wilcom-auto-1',
          category: 'TOP',
          styleName: preparedProgram.topName || preparedProgram.mainStyle || 'Primary Top Style',
          wilcomDesignNumber: preparedProgram.wilcomDesignNumber || preparedProgram.embroideryDesign || 'WLC-01',
          photoUrl: fallbackPhoto,
          remarks: preparedProgram.remarks || preparedProgram.comments || '',
        },
      ];
    }

    if (entries.length > 0) {
      meta = meta || {};
      meta.wilcomEntries = await Promise.all(
        entries.map(async (entry: any, idx: number) => {
          const rawPhoto = entry.photoUrl || entry.photo || entry.imageUrl || entry.image || (idx === 0 ? fallbackPhoto : '') || '';
          const embedded = rawPhoto ? await embedImage(rawPhoto, 'Wilcom entry photo') : '';
          return {
            ...entry,
            photoUrl: embedded,
          };
        })
      );
      preparedProgram.metadataJson = JSON.stringify(meta);
      if (meta.wilcomEntries[0]?.photoUrl && !preparedProgram.wilcomDesignPhoto) {
        preparedProgram.wilcomDesignPhoto = meta.wilcomEntries[0].photoUrl;
      }
    }
  } catch (err) {
    console.warn('Error embedding wilcom entries images:', err);
  }

  return preparedProgram;
}

/**
 * Generate authentic Wilcom Embroidery Specification Form document HTML
 */
export function generateWilcomFormHtml(program: any, filterCategory: GarmentCategory | 'ALL' = 'ALL'): string {
  const serialNo = program.programSerialNo || program.programNumber || '';
  const designNo = program.designNumber || program.designName || '';
  const clientName = program.clientName || program.buyerName || '';
  const dateVal = program.startDate || program.programDate 
    ? new Date(program.startDate || program.programDate).toLocaleDateString('en-GB') 
    : new Date().toLocaleDateString('en-GB');

  let wilcomEntries: WilcomEntry[] = [];
  const rootWilcomPhoto = program.wilcomDesignPhoto || program.baseDesignPhoto || '';

  if (program.metadataJson) {
    try {
      const meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
      if (Array.isArray(meta?.wilcomEntries)) {
        wilcomEntries = meta.wilcomEntries.map((e: any, idx: number) => ({
          ...e,
          photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || (idx === 0 ? rootWilcomPhoto : '') || '',
        }));
      }
    } catch {}
  }

  // Fallback for single wilcom design
  if (wilcomEntries.length === 0 && (program.wilcomDesignNumber || program.embroideryDesign || rootWilcomPhoto)) {
    wilcomEntries = [
      {
        id: 'legacy-1',
        category: 'TOP',
        styleName: program.topName || program.mainStyle || 'Primary Top Style',
        wilcomDesignNumber: program.wilcomDesignNumber || program.embroideryDesign || 'WLC-01',
        photoUrl: rootWilcomPhoto,
        remarks: program.remarks || program.comments || '',
      },
    ];
  } else if (wilcomEntries.length > 0 && rootWilcomPhoto && !wilcomEntries[0].photoUrl) {
    wilcomEntries[0].photoUrl = rootWilcomPhoto;
  }

  const filtered = filterCategory === 'ALL'
    ? wilcomEntries
    : wilcomEntries.filter((e) => e.category === filterCategory);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wilcom Form - ${serialNo}</title>
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
      color: #000000;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      padding: 16px;
      font-size: 12px;
    }
    .no-print-bar {
      max-width: 200mm;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #111827;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
    }
    .btn {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      border: none;
    }
    .btn-primary { background: #7c3aed; color: #ffffff; }
    .btn-outline { background: #374151; color: #ffffff; }
    .card-wrapper {
      max-width: 200mm;
      min-height: 275mm;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #000000;
      padding: 20px;
    }
    .header-box {
      border-bottom: 2px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 16px;
      text-align: center;
    }
    .company-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: #4338ca;
      margin-top: 4px;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      border: 1.5px solid #000;
      padding: 10px;
      margin-bottom: 16px;
      background: #f8fafc;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #475569; }
    .meta-val { font-size: 12px; font-weight: 800; color: #000; }
    .entries-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .wilcom-card {
      border: 1.5px solid #000000;
      border-radius: 4px;
      padding: 12px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .cat-badge {
      font-size: 11px;
      font-weight: 900;
      padding: 3px 8px;
      border-radius: 3px;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .cat-TOP { background: #2563eb; }
    .cat-BOTTOM { background: #059669; }
    .cat-DUPATTA { background: #d97706; }
    .wilcom-no {
      font-size: 15px;
      font-weight: 900;
      font-family: monospace;
      letter-spacing: 0.05em;
      color: #1e1b4b;
    }
    .card-body {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 14px;
      align-items: start;
    }
    .photo-box {
      width: 160px;
      height: 160px;
      border: 1.5px solid #cbd5e1;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      overflow: hidden;
    }
    .photo-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .info-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .info-row {
      display: flex;
      gap: 6px;
    }
    .info-key {
      font-weight: 800;
      min-width: 90px;
      color: #334155;
    }
    .info-val {
      font-weight: 600;
      color: #000000;
    }
    @media print {
      body { background: transparent; padding: 0; }
      .no-print-bar { display: none !important; }
      .card-wrapper { border: 2px solid #000; min-height: 280mm; width: 100%; }
      .photo-box { border: 1.5px solid #000 !important; background: #fff !important; }
      .photo-box img { display: block !important; max-width: 100% !important; max-height: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>Wilcom Embroidery Form</strong> &middot; Serial No. ${serialNo}
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" onclick="window.print()">
        🖨️ Print Form (A4)
      </button>
      <button class="btn btn-outline" onclick="window.close()">
        ✕ Close
      </button>
    </div>
  </div>

  <div class="card-wrapper">
    <div class="header-box">
      <div class="company-title">SHUBHAM FABRICS INDIA PVT. LTD.</div>
      <div class="doc-title">WILCOM EMBROIDERY SPECIFICATION FORM</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">DESIGN NO:</span>
        <span class="meta-val">${designNo || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">SERIAL NO:</span>
        <span class="meta-val">${serialNo || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">DATE:</span>
        <span class="meta-val">${dateVal}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">CLIENT / BUYER:</span>
        <span class="meta-val">${clientName || 'Standard Client'}</span>
      </div>
    </div>

    ${filtered.length === 0 ? `
      <div style="padding: 40px; text-align: center; border: 2px dashed #94a3b8; border-radius: 6px; color: #64748b; font-weight: 700;">
        No Wilcom embroidery designs recorded for ${filterCategory === 'ALL' ? 'this production order' : filterCategory}.
      </div>
    ` : `
      <div class="entries-grid">
        ${filtered.map((entry, idx) => `
          <div class="wilcom-card">
            <div class="card-head">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="cat-badge cat-${entry.category}">${entry.category}</span>
                <span style="font-weight: 800; font-size: 13px;">Entry #${idx + 1} &middot; ${entry.styleName || 'Garment Style'}</span>
              </div>
              <div class="wilcom-no">
                WILCOM #: ${entry.wilcomDesignNumber || 'N/A'}
              </div>
            </div>
            <div class="card-body">
              <div class="photo-box">
                ${entry.photoUrl ? `
                  <img src="${entry.photoUrl}" alt="${entry.wilcomDesignNumber}" />
                ` : `
                  <span style="font-size: 10px; font-weight: 700; color: #94a3b8; text-align: center; padding: 8px;">
                    No Photo Attached
                  </span>
                `}
              </div>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-key">Category:</span>
                  <span class="info-val">${entry.category} Garment Component</span>
                </div>
                <div class="info-row">
                  <span class="info-key">Style Details:</span>
                  <span class="info-val">${entry.styleName || 'Standard Style'}</span>
                </div>
                <div class="info-row">
                  <span class="info-key">Wilcom Design:</span>
                  <span class="info-val font-mono" style="font-weight: 900;">${entry.wilcomDesignNumber || '—'}</span>
                </div>
                ${entry.remarks ? `
                <div class="info-row">
                  <span class="info-key">Remarks:</span>
                  <span class="info-val">${entry.remarks}</span>
                </div>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  </div>
</body>
</html>`;
}

/**
 * Download Wilcom Form as an offline HTML file
 */
export async function downloadWilcomFormHtml(program: any, filterCategory: GarmentCategory | 'ALL' = 'ALL') {
  try {
    const preparedProgram = await prepareWilcomImages(program);
    const html = generateWilcomFormHtml(preparedProgram, filterCategory);
    const serialNo = program.programSerialNo || program.programNumber || 'PRG-SHEET';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Wilcom_Form_${filterCategory}_${serialNo}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Wilcom form could not be downloaded.';
    window.alert(`Wilcom form download failed: ${message}`);
  }
}

/**
 * Open print window for the Wilcom Form
 */
export function printWilcomForm(program: any, filterCategory: GarmentCategory | 'ALL' = 'ALL') {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    void (async () => {
      try {
        const preparedProgram = await prepareWilcomImages(program);
        printWindow.document.open();
        printWindow.document.write(generateWilcomFormHtml(preparedProgram, filterCategory));
        printWindow.document.close();

        const triggerPrint = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {}
        };

        if (printWindow.document.readyState === 'complete') {
          setTimeout(triggerPrint, 350);
        } else {
          printWindow.onload = () => setTimeout(triggerPrint, 350);
          setTimeout(triggerPrint, 800);
        }
      } catch (error) {
        printWindow.close();
        const message = error instanceof Error ? error.message : 'Failed to print Wilcom form.';
        window.alert(`Wilcom form print failed: ${message}`);
      }
    })();
  } else {
    void downloadWilcomFormHtml(program, filterCategory);
  }
}
