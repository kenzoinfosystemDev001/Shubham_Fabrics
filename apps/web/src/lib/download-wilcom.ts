/**
 * Wilcom Embroidery Specification Form Module
 * Dedicated module for Wilcom types, HTML generation, printing, and downloading.
 * Keeps Wilcom logic cleanly separated from Production Sheets and Challans.
 */

import { loadProgramDocument } from '@/lib/program-document';

export type GarmentCategory = 'TOP' | 'BOTTOM' | 'DUPATTA' | 'OTHER' | string;

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
 * Resizes and compresses an uploaded image file into an optimized JPEG Data URL.
 * Prevents massive payloads (e.g. 10MB phone photos) from choking memory, network, or printing.
 */
export async function compressImageForUpload(file: File, maxDim = 1600, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        resolve('');
        return;
      }
      const rawData = reader.result;
      if (typeof window === 'undefined') {
        resolve(rawData);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(rawData);
      img.onload = () => {
        try {
          let { naturalWidth: width, naturalHeight: height } = img;
          if (!width || !height) {
            resolve(rawData);
            return;
          }
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawData);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed || rawData);
        } catch {
          resolve(rawData);
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Resolves the primary Wilcom photo from any known field or nested structure.
 */
export function extractRootWilcomPhoto(program: any, meta?: any): string {
  let pMeta = meta;
  if (!pMeta && program?.metadataJson) {
    try {
      pMeta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {
      pMeta = null;
    }
  }

  if (program?.wilcomDesignPhoto && typeof program.wilcomDesignPhoto === 'string' && program.wilcomDesignPhoto.trim()) {
    return program.wilcomDesignPhoto.trim();
  }
  if (pMeta?.wilcomDesignPhoto && typeof pMeta.wilcomDesignPhoto === 'string' && pMeta.wilcomDesignPhoto.trim()) {
    return pMeta.wilcomDesignPhoto.trim();
  }

  // Check program wilcomEntries
  if (Array.isArray(program?.wilcomEntries)) {
    const found = program.wilcomEntries.find((e: any) => e?.photoUrl || e?.photo || e?.imageUrl || e?.image);
    const photo = found?.photoUrl || found?.photo || found?.imageUrl || found?.image;
    if (photo && typeof photo === 'string' && photo.trim()) return photo.trim();
  }

  // Check metadata wilcomEntries
  if (Array.isArray(pMeta?.wilcomEntries)) {
    const found = pMeta.wilcomEntries.find((e: any) => e?.photoUrl || e?.photo || e?.imageUrl || e?.image);
    const photo = found?.photoUrl || found?.photo || found?.imageUrl || found?.image;
    if (photo && typeof photo === 'string' && photo.trim()) return photo.trim();
  }

  return (
    program?.baseDesignPhoto ||
    pMeta?.baseDesignPhoto ||
    program?.photoUrl ||
    pMeta?.photoUrl ||
    program?.photo ||
    pMeta?.photo ||
    pMeta?.components?.TOP?.photoUrl ||
    pMeta?.components?.TOP?.photo ||
    ''
  );
}

/**
 * Converts image source into a base64 Data URL to guarantee offline rendering and printing.
 */
async function embedImage(source: string, label: string): Promise<string> {
  if (!source) return '';
  if (source.startsWith('data:image/')) return source;

  // 1. Try standard fetch & blob conversion
  try {
    const imageUrl = new URL(source, typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000');
    const response = await fetch(imageUrl, { credentials: 'omit' });
    if (response.ok) {
      const image = await response.blob();
      const res = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else resolve('');
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(image);
      });
      if (res && res.startsWith('data:image/')) return res;
    }
  } catch {}

  // 2. Fallback: Browser Image element & Canvas rendering (guarantees local offline base64 data URL)
  if (typeof window !== 'undefined') {
    try {
      const canvasRes = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 300;
            canvas.height = img.naturalHeight || img.height || 300;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.95));
              return;
            }
          } catch {}
          resolve('');
        };
        img.onerror = () => resolve('');
        img.src = source;
      });
      if (canvasRes && canvasRes.startsWith('data:image/')) return canvasRes;
    } catch {}
  }

  return source;
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

    const fallbackPhoto = extractRootWilcomPhoto(preparedProgram, meta);

    let entries: WilcomEntry[] = [];
    if (Array.isArray(preparedProgram.wilcomEntries) && preparedProgram.wilcomEntries.length > 0) {
      entries = preparedProgram.wilcomEntries;
    } else if (Array.isArray(meta?.wilcomEntries) && meta.wilcomEntries.length > 0) {
      entries = meta.wilcomEntries;
    }

    const designNo = preparedProgram.designNumber || preparedProgram.designName || '—';
    const mainStyle = preparedProgram.mainStyle || preparedProgram.topName || meta?.mainStyle || meta?.topName || '—';
    const subStyle = preparedProgram.subStyle || preparedProgram.styleCode || meta?.subStyle || meta?.style || '—';

    if (entries.length === 0) {
      entries = [
        {
          id: 'wilcom-auto-1',
          category: 'TOP',
          styleName: subStyle !== '—' ? subStyle : (mainStyle !== '—' ? mainStyle : 'Style'),
          wilcomDesignNumber: preparedProgram.wilcomDesignNumber || preparedProgram.embroideryDesign || (designNo !== '—' ? designNo : 'WLC-01'),
          photoUrl: fallbackPhoto,
          remarks: preparedProgram.remarks || preparedProgram.comments || '',
        },
      ];
    }

    if (entries.length > 0) {
      meta = meta || {};
      meta.wilcomEntries = await Promise.all(
        entries.map(async (entry: any) => {
          const rawPhoto = entry.photoUrl || entry.photo || entry.imageUrl || entry.image || fallbackPhoto || '';
          const embedded = rawPhoto ? await embedImage(rawPhoto, 'Wilcom entry photo') : '';
          return {
            ...entry,
            photoUrl: embedded || rawPhoto || fallbackPhoto,
          };
        })
      );
      preparedProgram.metadataJson = JSON.stringify(meta);
      preparedProgram.wilcomEntries = meta.wilcomEntries;
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
  const serialNo = program.programSerialNo || program.programNumber || '—';
  const designNo = program.designNumber || program.designName || program.wilcomDesignNumber || '—';

  let meta: any = null;
  if (program.metadataJson) {
    try {
      meta = typeof program.metadataJson === 'string' ? JSON.parse(program.metadataJson) : program.metadataJson;
    } catch {}
  }

  const mainStyle = program.mainStyle || program.topName || meta?.mainStyle || meta?.topName || '—';
  const subStyle = program.subStyle || program.styleCode || meta?.subStyle || meta?.style || '—';

  const rootWilcomPhoto = extractRootWilcomPhoto(program, meta);

  let wilcomEntries: WilcomEntry[] = [];

  if (Array.isArray(program.wilcomEntries) && program.wilcomEntries.length > 0) {
    wilcomEntries = program.wilcomEntries.map((e: any) => ({
      ...e,
      photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || rootWilcomPhoto || '',
    }));
  } else if (Array.isArray(meta?.wilcomEntries) && meta.wilcomEntries.length > 0) {
    wilcomEntries = meta.wilcomEntries.map((e: any) => ({
      ...e,
      photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || rootWilcomPhoto || '',
    }));
  }

  // Always ensure at least 1 entry is present with full details
  if (wilcomEntries.length === 0) {
    wilcomEntries = [
      {
        id: 'wilcom-auto-1',
        category: 'TOP',
        styleName: subStyle !== '—' ? subStyle : (mainStyle !== '—' ? mainStyle : 'Style'),
        wilcomDesignNumber: program.wilcomDesignNumber || program.embroideryDesign || (designNo !== '—' ? designNo : 'WLC-01'),
        photoUrl: rootWilcomPhoto,
        remarks: program.remarks || program.comments || '',
      },
    ];
  } else {
    // Ensure any entry missing a photo inherits rootWilcomPhoto
    wilcomEntries = wilcomEntries.map((e) => ({
      ...e,
      photoUrl: e.photoUrl || rootWilcomPhoto || '',
    }));
  }

  const normFilter = String(filterCategory || 'ALL').trim().toUpperCase();
  const filtered = (normFilter === 'ALL' || !normFilter)
    ? wilcomEntries
    : wilcomEntries.filter((e) => {
        const cat = String(e.category || '').trim().toUpperCase();
        return cat === normFilter || cat.includes(normFilter) || normFilter.includes(cat);
      });

  const finalEntries = filtered.length > 0 ? filtered : wilcomEntries;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wilcom ${filterCategory === 'ALL' ? '' : filterCategory + ' '}Sheet - ${serialNo}</title>
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
    .meta-val {
      min-width: 0;
      font-size: 12px;
      font-weight: 800;
      color: #000;
      line-height: 1.25;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
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
      flex-wrap: wrap;
      gap: 8px;
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
      background: #334155;
    }
    .cat-TOP { background: #163767; }
    .cat-BOTTOM { background: #059669; }
    .cat-DUPATTA { background: #d97706; }
    .wilcom-no {
      max-width: 58%;
      font-size: 12px;
      font-weight: 900;
      font-family: monospace;
      line-height: 1.25;
      letter-spacing: 0.02em;
      color: #1e1b4b;
      text-align: right;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
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
      min-width: 0;
      flex-wrap: wrap;
    }
    .info-key {
      font-weight: 800;
      min-width: 90px;
      color: #334155;
    }
    .info-val {
      min-width: 0;
      font-weight: 600;
      color: #000000;
      overflow-wrap: anywhere;
      word-break: break-word;
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
      <strong>Wilcom ${filterCategory === 'ALL' ? '' : filterCategory + ' '}Embroidery Sheet</strong> &middot; Design ${designNo} &middot; Serial No. ${serialNo}
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-primary" onclick="window.print()">
        🖨️ Print Wilcom ${filterCategory === 'ALL' ? '' : filterCategory + ' '}Sheet (A4)
      </button>
      <button class="btn btn-primary" style="background: #059669;" onclick="window.downloadSelf()">
        💾 Download Wilcom ${filterCategory === 'ALL' ? '' : filterCategory + ' '}Sheet
      </button>
      <button class="btn btn-outline" onclick="window.close()">
        ✕ Close
      </button>
    </div>
  </div>

  <div class="card-wrapper" id="wilcom-document">
    <div class="header-box">
      <div class="company-title">SHUBHAM FABRICS INDIA PVT. LTD.</div>
      <div class="doc-title">WILCOM ${filterCategory === 'ALL' ? '' : filterCategory + ' '}EMBROIDERY SPECIFICATION SHEET</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">DESIGN NO:</span>
        <span class="meta-val font-mono" style="font-size: 14px;">${designNo || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">SERIAL NO:</span>
        <span class="meta-val font-mono" style="font-size: 14px;">${serialNo || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">MAIN STYLE:</span>
        <span class="meta-val" style="font-size: 13px; font-weight: 800;">${mainStyle || '—'}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">STYLE:</span>
        <span class="meta-val" style="font-size: 13px; font-weight: 800;">${subStyle || '—'}</span>
      </div>
    </div>

    ${finalEntries.length === 0 ? `
      <div style="padding: 40px; text-align: center; border: 2px dashed #94a3b8; border-radius: 6px; color: #64748b; font-weight: 700;">
        No Wilcom embroidery designs recorded for ${filterCategory === 'ALL' ? 'this production order' : filterCategory}.
      </div>
    ` : `
      <div class="entries-grid">
        ${finalEntries.map((entry, idx) => `
          <div class="wilcom-card">
            <div class="card-head">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="cat-badge cat-${entry.category}">WILCOM ${entry.category}</span>
                <span style="font-weight: 800; font-size: 13px;">${entry.styleName || `Design #${idx + 1}`}</span>
              </div>
              <div class="wilcom-no">
                ${entry.wilcomDesignNumber || 'N/A'}
              </div>
            </div>
            <div class="card-body">
              <div class="photo-box">
                ${entry.photoUrl ? `
                  <img src="${entry.photoUrl}" alt="${entry.wilcomDesignNumber || 'Wilcom Artwork'}" />
                ` : `
                  <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-align: center; padding: 12px;">
                    No Artwork Photo
                  </span>
                `}
              </div>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-key">Design No:</span>
                  <span class="info-val font-mono" style="font-weight: 900; font-size: 13px;">${designNo || '—'}</span>
                </div>
                <div class="info-row">
                  <span class="info-key">Serial No:</span>
                  <span class="info-val font-mono" style="font-weight: 900; font-size: 13px;">${serialNo || '—'}</span>
                </div>
                <div class="info-row">
                  <span class="info-key">Main Style:</span>
                  <span class="info-val" style="font-weight: 800;">${mainStyle || '—'}</span>
                </div>
                <div class="info-row">
                  <span class="info-key">Style:</span>
                  <span class="info-val" style="font-weight: 800;">${entry.styleName || subStyle || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `}

    <!-- DUAL AUTHORIZATION SIGNATURES -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; padding-top: 16px; border-top: 1.5px solid #000;">
      <div style="text-align: center;">
        <div style="border-bottom: 1.5px solid #000; width: 80%; margin: 0 auto 8px auto; height: 32px;"></div>
        <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #000;">PREPARED BY (WILCOM / CAD DESIGNER)</div>
      </div>
      <div style="text-align: center;">
        <div style="border-bottom: 1.5px solid #000; width: 80%; margin: 0 auto 8px auto; height: 32px;"></div>
        <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #000;">VERIFIED BY (EMBROIDERY / FLOOR MASTER)</div>
      </div>
    </div>
  </div>

  <script>
    window.downloadSelf = function() {
      var blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = "Wilcom_Form_${filterCategory}_${designNo}_${serialNo}.html";
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
 * Download Wilcom Form as an offline HTML file
 */
export async function downloadWilcomFormHtml(program: any, filterCategory: GarmentCategory | 'ALL' = 'ALL') {
  try {
    const completeProgram = await loadProgramDocument(program);
    const preparedProgram = await prepareWilcomImages(completeProgram);
    const html = generateWilcomFormHtml(preparedProgram, filterCategory);
    const serialNo = completeProgram.programSerialNo || completeProgram.programNumber || 'PRG-SHEET';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Wilcom_${filterCategory}_Sheet_${serialNo}.html`;
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
        const completeProgram = await loadProgramDocument(program);
        const preparedProgram = await prepareWilcomImages(completeProgram);
        printWindow.document.open();
        printWindow.document.write(generateWilcomFormHtml(preparedProgram, filterCategory));
        printWindow.document.close();

        const triggerPrint = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {}
        };

        const waitForImagesAndPrint = () => {
          try {
            const images = Array.from(printWindow.document.images || []);
            if (images.length === 0 || images.every((img) => img.complete)) {
              setTimeout(triggerPrint, 250);
              return;
            }
            let pending = images.length;
            const onDone = () => {
              pending--;
              if (pending <= 0) setTimeout(triggerPrint, 250);
            };
            images.forEach((img) => {
              if (img.complete) onDone();
              else {
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
              }
            });
            setTimeout(triggerPrint, 1200);
          } catch {
            setTimeout(triggerPrint, 400);
          }
        };

        if (printWindow.document.readyState === 'complete') {
          waitForImagesAndPrint();
        } else {
          printWindow.onload = () => waitForImagesAndPrint();
          setTimeout(waitForImagesAndPrint, 800);
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
