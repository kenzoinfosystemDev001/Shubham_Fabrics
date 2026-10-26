/**
 * Standard Code-128 Barcode & Manufacturing Sticker Generator
 * Shubham Fabrics India Pvt. Ltd. MES
 *
 * Implements ISO/IEC 15417 Code-128 (Subset B) barcode encoding
 * with factory sticker labels containing:
 * - Production Sheet Design Number
 * - Respective Department Name & Transfer Route
 * - Scannable Code-128 Barcode
 * - Standalone High-Resolution PNG & SVG Downloads
 * - Dedicated Thermal Label Printing
 */

// ISO/IEC 15417 Code-128 Patterns (0 - 106)
// Each 6-character string represents widths of alternating bars (even) and spaces (odd) totaling 11 modules.
// Pattern 106 is the Stop symbol (13 modules: 2331112).
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const START_B_INDEX = 104;
const STOP_INDEX = 106;

export interface BarcodeStickerParams {
  challanNumber: string;
  designNumber: string;
  departmentName: string;
  fromDepartment?: string;
  toDepartment?: string;
  programSerialNo?: string;
  clientName?: string;
  mainStyle?: string;
  totalQuantity?: number | string;
  uom?: string;
  date?: string;
}

/**
 * Encodes string to Code-128 Subset B patterns and generates SVG path elements.
 */
export function generateCode128SvgBars(
  text: string,
  moduleWidth: number = 2,
  barHeight: number = 54
): { svgBars: string; totalWidth: number; totalHeight: number } {
  const sanitized = (text || 'SF-0000').trim().slice(0, 48);
  
  // Calculate Code-128 checksum
  let checksum = START_B_INDEX;
  const symbolIndices: number[] = [START_B_INDEX];

  for (let i = 0; i < sanitized.length; i++) {
    const code = sanitized.charCodeAt(i);
    // Code 128B maps ASCII 32 to 127: index = code - 32
    const val = code >= 32 && code <= 127 ? code - 32 : 0;
    symbolIndices.push(val);
    checksum += val * (i + 1);
  }

  symbolIndices.push(checksum % 103);
  symbolIndices.push(STOP_INDEX);

  // Quiet zones (10 modules on each side)
  const quietZone = 12 * moduleWidth;
  let currentX = quietZone;
  const rects: string[] = [];

  for (const symIndex of symbolIndices) {
    const pattern = CODE128_PATTERNS[symIndex] || CODE128_PATTERNS[0];
    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10) * moduleWidth;
      const isBar = p % 2 === 0;
      if (isBar) {
        rects.push(`<rect x="${currentX}" y="0" width="${width}" height="${barHeight}" fill="#000000" />`);
      }
      currentX += width;
    }
  }

  const totalWidth = currentX + quietZone;
  return {
    svgBars: rects.join(''),
    totalWidth,
    totalHeight: barHeight
  };
}

/**
 * Returns raw standalone SVG string of the barcode only.
 */
export function generateRawBarcodeSvg(
  barcodeData: string,
  humanText?: string,
  width: number = 280,
  height: number = 72
): string {
  const { svgBars, totalWidth, totalHeight } = generateCode128SvgBars(barcodeData, 2, 46);
  const label = humanText || barcodeData;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight + 22}" width="${width}" height="${height}">
    <rect width="${totalWidth}" height="${totalHeight + 22}" fill="#ffffff" />
    <g>${svgBars}</g>
    <text x="${totalWidth / 2}" y="${totalHeight + 16}" text-anchor="middle" font-family="'Courier New', monospace" font-size="12" font-weight="bold" fill="#000000" letter-spacing="1.5">
      ${escapeXml(label)}
    </text>
  </svg>`;
}

/**
 * Generates an authentic Industrial Barcode Dispatch Sticker SVG.
 * Features:
 * 1. Respective Department Name & Transfer Route
 * 2. Production Sheet Design Number (large, high-contrast)
 * 3. Scannable Code-128 Barcode
 * 4. Challan number, date, and piece count
 */
export function generateBarcodeStickerSvg(params: BarcodeStickerParams): string {
  const {
    challanNumber,
    designNumber,
    departmentName,
    fromDepartment = '',
    toDepartment = '',
    programSerialNo = '—',
    clientName = 'Standard Client',
    mainStyle = '—',
    totalQuantity = '—',
    uom = 'PCS',
    date = new Date().toLocaleDateString('en-IN')
  } = params;

  // The barcode encodes the unique Challan & Design identifier
  const barcodeValue = `${challanNumber}`;
  const barcodeHuman = `* ${designNumber || 'DESIGN'} · ${challanNumber} *`;

  const { svgBars, totalWidth: barSvgWidth } = generateCode128SvgBars(barcodeValue, 2, 52);

  // Dimensions of standard 4" x 2.6" industrial label (440px x 280px)
  const labelWidth = 460;
  const labelHeight = 290;

  // Scale bars to fit inside label
  const targetBarWidth = 400;
  const barScale = targetBarWidth / barSvgWidth;
  const barOffsetX = (labelWidth - targetBarWidth) / 2;

  const displayDept = (departmentName || fromDepartment || 'PRODUCTION').toUpperCase();
  const routeText = fromDepartment && toDepartment ? `${fromDepartment} → ${toDepartment}` : displayDept;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${labelWidth} ${labelHeight}" width="${labelWidth}" height="${labelHeight}">
    <defs>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#000000" />
        <stop offset="100%" stop-color="#000000" />
      </linearGradient>
    </defs>

    <!-- Outer Card Background with Rounded Border -->
    <rect x="2" y="2" width="${labelWidth - 4}" height="${labelHeight - 4}" rx="12" fill="#ffffff" stroke="#000000" stroke-width="2.5" />

    <!-- TOP HEADER BAR: COMPANY & DEPARTMENT -->
    <rect x="3" y="3" width="${labelWidth - 6}" height="42" rx="10" fill="url(#headerGrad)" />
    <!-- Fix bottom corners of header -->
    <rect x="3" y="30" width="${labelWidth - 6}" height="15" fill="#000000" />

    <text x="16" y="20" font-family="'Manrope', -apple-system, sans-serif" font-size="9" font-weight="800" fill="#ffffff" letter-spacing="1.5">
      SHUBHAM FABRICS INDIA PVT. LTD.
    </text>
    <text x="16" y="34" font-family="'Manrope', -apple-system, sans-serif" font-size="12" font-weight="900" fill="#ffffff" letter-spacing="0.5">
      DEPT: ${escapeXml(displayDept)}
    </text>

    <!-- Route Badge Top Right -->
    <rect x="${labelWidth - 190}" y="10" width="176" height="24" rx="5" fill="#ffffff" fill-opacity="0.18" stroke="#ffffff" stroke-width="0.8" />
    <text x="${labelWidth - 102}" y="26" text-anchor="middle" font-family="'Manrope', monospace" font-size="11" font-weight="800" fill="#ffffff" letter-spacing="0.5">
      ${escapeXml(routeText)}
    </text>

    <!-- PRIMARY IDENTIFIER: PRODUCTION SHEET DESIGN NUMBER -->
    <g transform="translate(16, 52)">
      <!-- Design Number Callout Box -->
      <rect x="0" y="4" width="${labelWidth - 32}" height="42" rx="8" fill="#f8f7fa" stroke="#d3ced8" stroke-width="1.2" />
      
      <text x="12" y="20" font-family="'Manrope', sans-serif" font-size="9" font-weight="800" fill="#6b6872" letter-spacing="1">
        PRODUCTION SHEET DESIGN NUMBER
      </text>
      <text x="12" y="38" font-family="'Manrope', monospace" font-size="17" font-weight="900" fill="#000000" letter-spacing="0.5">
        ${escapeXml(designNumber || 'STANDARD DESIGN')}
      </text>

      <text x="${labelWidth - 44}" y="20" text-anchor="end" font-family="'Manrope', sans-serif" font-size="9" font-weight="800" fill="#6b6872" letter-spacing="0.5">
        MASTER SHEET: ${escapeXml(programSerialNo)}
      </text>
      <text x="${labelWidth - 44}" y="36" text-anchor="end" font-family="'Manrope', sans-serif" font-size="10" font-weight="700" fill="#43404a">
        Style: ${escapeXml(mainStyle)} · ${escapeXml(clientName)}
      </text>
    </g>

    <!-- CENTER: CODE-128 BARCODE -->
    <g transform="translate(${barOffsetX}, 108) scale(${barScale}, 1)">
      ${svgBars}
    </g>

    <!-- Human Readable Barcode Text -->
    <text x="${labelWidth / 2}" y="178" text-anchor="middle" font-family="'Courier New', monospace" font-size="11.5" font-weight="bold" fill="#000000" letter-spacing="1">
      ${escapeXml(barcodeHuman)}
    </text>

    <line x1="16" y1="190" x2="${labelWidth - 16}" y2="190" stroke="#e5e1e8" stroke-width="1.5" stroke-dasharray="4 3" />

    <!-- BOTTOM ROW: CHALLAN METADATA & DISPATCH QUANTITY -->
    <g transform="translate(16, 198)">
      <!-- Challan Number -->
      <text x="0" y="14" font-family="'Manrope', sans-serif" font-size="9" font-weight="800" fill="#6b6872" letter-spacing="0.5">
        DISPATCH CHALLAN NUMBER
      </text>
      <text x="0" y="32" font-family="'Manrope', monospace" font-size="13" font-weight="900" fill="#000000">
        ${escapeXml(challanNumber)}
      </text>

      <!-- Date -->
      <text x="0" y="48" font-family="'Manrope', sans-serif" font-size="10" font-weight="600" fill="#6b6872">
        Date: ${escapeXml(date)}
      </text>

      <!-- Quantity Box Right -->
      <rect x="${labelWidth - 192}" y="2" width="160" height="52" rx="8" fill="#ffffff" stroke="#000000" stroke-width="1.2" />
      <text x="${labelWidth - 112}" y="18" text-anchor="middle" font-family="'Manrope', sans-serif" font-size="9" font-weight="800" fill="#000000" letter-spacing="0.8">
        DISPATCHED QUANTITY
      </text>
      <text x="${labelWidth - 112}" y="42" text-anchor="middle" font-family="'Manrope', monospace" font-size="20" font-weight="900" fill="#000000">
        ${escapeXml(String(totalQuantity))} ${escapeXml(uom)}
      </text>
    </g>

    <!-- Scan Directives Small Footer -->
    <rect x="3" y="${labelHeight - 22}" width="${labelWidth - 6}" height="19" rx="8" fill="#f1eff4" />
    <text x="${labelWidth / 2}" y="${labelHeight - 9}" text-anchor="middle" font-family="'Manrope', sans-serif" font-size="8.5" font-weight="700" fill="#57545e" letter-spacing="0.5">
      MANDATORY LOT IDENTIFICATION STICKER · SCAN AT NEXT DEPARTMENT GATE
    </text>
  </svg>`;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Downloads the barcode sticker as a high-resolution standalone PNG image (300 DPI quality).
 */
export async function downloadBarcodeStickerPng(
  params: BarcodeStickerParams,
  filename?: string
): Promise<void> {
  const svgString = generateBarcodeStickerSvg(params);
  const safeFilename =
    filename ||
    `barcode-${(params.designNumber || 'DESIGN').replace(/[^a-zA-Z0-9_-]/g, '_')}-${params.challanNumber || 'challan'}.png`;

  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          // Render at 2.5x resolution (1150 x 725) for ultra-sharp thermal printing
          const scale = 2.5;
          const canvas = document.createElement('canvas');
          canvas.width = 460 * scale;
          canvas.height = 290 * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);

          canvas.toBlob((pngBlob) => {
            if (!pngBlob) {
              reject(new Error('Failed to create PNG blob'));
              return;
            }
            const downloadUrl = URL.createObjectURL(pngBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = safeFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            resolve();
          }, 'image/png');
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Downloads the barcode sticker as an SVG vector file.
 */
export function downloadBarcodeStickerSvg(
  params: BarcodeStickerParams,
  filename?: string
): void {
  const svgString = generateBarcodeStickerSvg(params);
  const safeFilename =
    filename ||
    `barcode-${(params.designNumber || 'DESIGN').replace(/[^a-zA-Z0-9_-]/g, '_')}-${params.challanNumber || 'challan'}.svg`;

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a dedicated standalone thermal sticker print dialog.
 */
export function printBarcodeSticker(params: BarcodeStickerParams): void {
  const svgString = generateBarcodeStickerSvg(params);
  const printWindow = window.open('', '_blank', 'width=600,height=500');
  if (!printWindow) {
    alert('Please allow popups to print the barcode sticker.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Barcode Sticker - ${params.challanNumber}</title>
        <style>
          @page {
            size: 100mm 65mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            width: 100vw;
            height: 100vh;
            padding: 4mm;
            font-family: 'Manrope', -apple-system, sans-serif;
          }
          .sticker-container {
            width: 100%;
            max-width: 100mm;
            height: auto;
          }
          svg {
            width: 100%;
            height: auto;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="sticker-container">
          ${svgString}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
