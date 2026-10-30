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
 * The Wilcom category a production sheet's designs are saved under.
 * Added styles have internal ids (CUSTOM_...); their designs are stored under the style's name.
 */
export function wilcomCategoryFor(category: GarmentCategory | 'ALL', meta?: any): string {
  const cat = String(category || 'ALL').trim().toUpperCase();
  if (cat === 'ALL' || cat === 'TOP' || cat === 'BOTTOM' || cat === 'DUPATTA') return cat;
  const styleName = String(meta?.components?.[category]?.styleName || '').trim().toUpperCase();
  return styleName || cat;
}

/**
 * Only the designs of one production sheet; another sheet's designs never stand in for a sheet that has none.
 */
export function filterWilcomEntriesByCategory<T extends { category?: string }>(
  entries: T[],
  category: GarmentCategory | 'ALL',
  meta?: any
): T[] {
  const id = String(category || 'ALL').trim().toUpperCase();
  const name = wilcomCategoryFor(category, meta);
  if (id === 'ALL') return entries;
  return entries.filter((e) => {
    const cat = String(e.category || '').trim().toUpperCase();
    return cat === id || cat === name;
  });
}

/**
 * The root Wilcom photo is the TOP sheet's legacy artwork; another sheet's design never borrows it.
 */
export function inheritedWilcomPhoto(entry: { category?: string } | null | undefined, rootPhoto: string): string {
  return String(entry?.category || 'TOP').trim().toUpperCase() === 'TOP' ? rootPhoto : '';
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
          const ownFallback = inheritedWilcomPhoto(entry, fallbackPhoto);
          const rawPhoto = entry.photoUrl || entry.photo || entry.imageUrl || entry.image || ownFallback || '';
          const embedded = rawPhoto ? await embedImage(rawPhoto, 'Wilcom entry photo') : '';
          return {
            ...entry,
            photoUrl: embedded || rawPhoto || ownFallback,
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
/** Escapes typed text before it goes into the printed HTML. */
function escapeHtmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
      photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || inheritedWilcomPhoto(e, rootWilcomPhoto) || '',
    }));
  } else if (Array.isArray(meta?.wilcomEntries) && meta.wilcomEntries.length > 0) {
    wilcomEntries = meta.wilcomEntries.map((e: any) => ({
      ...e,
      photoUrl: e.photoUrl || e.photo || e.imageUrl || e.image || inheritedWilcomPhoto(e, rootWilcomPhoto) || '',
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
    // A TOP entry missing a photo inherits rootWilcomPhoto
    wilcomEntries = wilcomEntries.map((e) => ({
      ...e,
      photoUrl: e.photoUrl || inheritedWilcomPhoto(e, rootWilcomPhoto) || '',
    }));
  }

  const finalEntries = filterWilcomEntriesByCategory(wilcomEntries, filterCategory, meta);
  const categoryLabel = wilcomCategoryFor(filterCategory, meta);
  const categoryPrefix = categoryLabel === 'ALL' ? '' : categoryLabel + ' ';

  const esc = escapeHtmlText;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wilcom ${esc(categoryPrefix)}Sheet - ${esc(serialNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #f1eff4; color: #1c1a20; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 12px; padding: 16px; }
    .toolbar { max-width: 186mm; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }
    .btn { cursor: pointer; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid #d3ced8; background: #fff; color: #1c1a20; }
    .btn-primary { background: #7442a6; border-color: #7442a6; color: #fff; }
    .sheet { max-width: 186mm; margin: 0 auto; background: #fff; padding: 24px; border-radius: 8px; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 14px; border-bottom: 2px solid #1c1a20; }
    .company { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: #57545e; }
    .title { font-size: 24px; font-weight: 800; margin-top: 2px; }
    .ids { display: flex; gap: 24px; text-align: right; }
    .id-label { font-size: 10px; color: #6b6872; }
    .id-value { font-size: 15px; font-weight: 800; }
    .designs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
    .design { border: 1px solid #d3ced8; border-radius: 8px; padding: 10px; page-break-inside: avoid; }
    .photo { height: 240px; display: flex; align-items: center; justify-content: center; background: #faf9fb; border-radius: 6px; overflow: hidden; }
    .photo img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .no-photo { color: #8f8a96; font-weight: 700; }
    .design-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 8px; }
    .style-name { font-size: 14px; font-weight: 800; }
    .wilcom-no { font-size: 11px; color: #57545e; font-family: monospace; text-align: right; overflow-wrap: anywhere; }
    .empty { margin-top: 18px; padding: 32px; text-align: center; border: 1.5px dashed #b3adb9; border-radius: 8px; color: #6b6872; font-weight: 700; }
    .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
    .sign { border-top: 1px solid #1c1a20; padding-top: 6px; text-align: center; font-size: 11px; font-weight: 700; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { max-width: none; padding: 0; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet" id="wilcom-document">
    <div class="head">
      <div>
        <div class="company">SHUBHAM FABRICS INDIA PVT. LTD.</div>
        <div class="title">Wilcom ${esc(categoryPrefix)}Sheet</div>
      </div>
      <div class="ids">
        <div><div class="id-label">Design No.</div><div class="id-value">${esc(designNo || '—')}</div></div>
        <div><div class="id-label">Serial No.</div><div class="id-value">${esc(serialNo || '—')}</div></div>
      </div>
    </div>

    ${finalEntries.length === 0 ? `
      <div class="empty">No Wilcom designs for ${esc(categoryLabel === 'ALL' ? 'this production sheet' : categoryLabel)}.</div>
    ` : `
      <div class="designs">
        ${finalEntries.map((entry, idx) => `
          <div class="design">
            <div class="photo">
              ${entry.photoUrl
                ? `<img src="${esc(entry.photoUrl)}" alt="${esc(entry.styleName || `Design ${idx + 1}`)}" />`
                : `<span class="no-photo">No picture</span>`}
            </div>
            <div class="design-foot">
              <span class="style-name">${esc(entry.styleName || `Design ${idx + 1}`)}</span>
              <span class="wilcom-no">${esc(entry.wilcomDesignNumber || '')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `}

    <div class="signs">
      <div class="sign">Prepared by</div>
      <div class="sign">Verified by</div>
    </div>
  </div>
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
    let meta: any = null;
    try {
      meta = typeof preparedProgram.metadataJson === 'string' ? JSON.parse(preparedProgram.metadataJson) : preparedProgram.metadataJson;
    } catch {}
    const categoryLabel = wilcomCategoryFor(filterCategory, meta).replace(/[^a-z0-9_-]+/gi, '_');
    a.download = `Wilcom_${categoryLabel}_Sheet_${serialNo}.html`;
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
