// Generates one 640x360 textile illustration per department (SVG), in the MES brand palette.
// Usage: node gen-dept-art.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2];
fs.mkdirSync(outDir, { recursive: true });

const L = { lav: '#B57EDC', lavD: '#8E5AB5', lavDD: '#6E4590', lavL: '#E2CFF0', lavLL: '#F7F0FB', chart: '#DFFF00', chartM: '#C8D94A', tom: '#FF6347', tomL: '#FFB3A6', ink: '#4A3A57' };

const TINTS = {
  lavender: ['#EFE4F7', '#E2CFF0', '#F7F0FB'],
  blush: ['#FBE9E5', '#F6D5CE', '#FDF4F2'],
  lime: ['#F5F9DD', '#EAF2BE', '#FBFDEE'],
  lilac: ['#EEEBF2', '#E0DBE7', '#F7F5FA'],
  mist: ['#EAEDF7', '#D9DFF0', '#F5F7FC'],
};

function base(tint) {
  const [bg, warp, weft] = TINTS[tint];
  return `
  <defs>
    <pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="${bg}"/>
      <rect x="0" y="0.6" width="4" height="2.8" rx="1.2" fill="${warp}"/>
      <rect x="4" y="4.6" width="4" height="2.8" rx="1.2" fill="${warp}"/>
      <rect x="4.6" y="0" width="2.8" height="4" rx="1.2" fill="${weft}"/>
      <rect x="0.6" y="4" width="2.8" height="4" rx="1.2" fill="${weft}"/>
    </pattern>
    <pattern id="weaveBig" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="${bg}"/>
      <rect x="0" y="1.5" width="10" height="7" rx="3" fill="${warp}"/>
      <rect x="10" y="11.5" width="10" height="7" rx="3" fill="${warp}"/>
      <rect x="11.5" y="0" width="7" height="10" rx="3" fill="${weft}"/>
      <rect x="1.5" y="10" width="7" height="10" rx="3" fill="${weft}"/>
    </pattern>
    <linearGradient id="fold" x1="0" y1="0" x2="1" y2="0.35">
      <stop offset="0" stop-color="#FFF" stop-opacity="0.5"/>
      <stop offset="0.2" stop-color="${L.lav}" stop-opacity="0.08"/>
      <stop offset="0.4" stop-color="#FFF" stop-opacity="0.4"/>
      <stop offset="0.6" stop-color="${L.lavD}" stop-opacity="0.12"/>
      <stop offset="0.8" stop-color="#FFF" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${L.lav}" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF" stop-opacity="0"/>
      <stop offset="1" stop-color="${L.lavDD}" stop-opacity="0.12"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="${L.lavDD}" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="640" height="360" fill="url(#weave)"/>
  <rect width="640" height="360" fill="url(#fold)"/>`;
}

const finish = `
  <rect width="640" height="360" fill="url(#shade)"/>
  <rect x="0" y="342" width="640" height="2" fill="${L.chart}" fill-opacity="0.55"/>
  <rect x="0" y="347" width="640" height="1" fill="${L.tom}" fill-opacity="0.35"/>`;

// ---------- reusable motifs ----------
const check = (x, y, r, fill = L.chart) => `
  <g filter="url(#soft)"><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>
  <path d="M${x - r * 0.45} ${y} l${r * 0.3} ${r * 0.32} l${r * 0.6} ${-r * 0.62}" fill="none" stroke="${L.ink}" stroke-width="${r * 0.18}" stroke-linecap="round" stroke-linejoin="round"/></g>`;

const scissors = (x, y, s = 1, rot = 0) => `
  <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" filter="url(#soft)">
    <path d="M0 -6 L120 -22 L118 -14 Z" fill="#E9E4EF" stroke="${L.lavDD}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M0 6 L120 22 L118 14 Z" fill="#F4F1F7" stroke="${L.lavDD}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="0" cy="0" r="5" fill="${L.lavDD}"/>
    <ellipse cx="-38" cy="-22" rx="24" ry="16" fill="none" stroke="${L.lavD}" stroke-width="9"/>
    <ellipse cx="-38" cy="22" rx="24" ry="16" fill="none" stroke="${L.lavD}" stroke-width="9"/>
    <path d="M-16 -14 L0 -4 M-16 14 L0 4" stroke="${L.lavD}" stroke-width="9" stroke-linecap="round"/>
  </g>`;

const magnifier = (x, y, r, inner = '') => `
  <g filter="url(#soft)">
    <line x1="${x + r * 0.7}" y1="${y + r * 0.7}" x2="${x + r * 1.45}" y2="${y + r * 1.45}" stroke="${L.lavDD}" stroke-width="${r * 0.22}" stroke-linecap="round"/>
    <clipPath id="lens${x}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>
    <g clip-path="url(#lens${x})"><rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="url(#weaveBig)"/>${inner}</g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#FFF" fill-opacity="0.18" stroke="${L.lavD}" stroke-width="${r * 0.12}"/>
    <path d="M${x - r * 0.55} ${y - r * 0.25} A ${r * 0.6} ${r * 0.6} 0 0 1 ${x - r * 0.2} ${y - r * 0.58}" stroke="#FFF" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.8"/>
  </g>`;

const tag = (x, y, inner = '') => `
  <g filter="url(#soft)">
    <path d="M${x} ${y - 70} C ${x - 20} ${y - 100}, ${x + 30} ${y - 120}, ${x + 10} ${y - 150}" stroke="${L.lavD}" stroke-width="2.5" fill="none"/>
    <path d="M${x - 34} ${y - 50} L${x} ${y - 78} L${x + 34} ${y - 50} L${x + 34} ${y + 40} L${x - 34} ${y + 40} Z" fill="#FFFDF9" stroke="${L.lavD}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${x}" cy="${y - 56}" r="5" fill="none" stroke="${L.lavD}" stroke-width="2.5"/>
    <rect x="${x - 22}" y="${y + 18}" width="44" height="4" rx="2" fill="${L.lavL}"/><rect x="${x - 22}" y="${y + 27}" width="30" height="4" rx="2" fill="${L.lavL}"/>
    ${inner}
  </g>`;

const button = (x, y, r, fill) => `
  <g filter="url(#soft)"><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${L.lavD}" stroke-width="2"/>
  <circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="none" stroke="#FFF" stroke-opacity="0.6" stroke-width="1.5"/>
  ${[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => `<circle cx="${x + a * r * 0.25}" cy="${y + b * r * 0.25}" r="${r * 0.11}" fill="${L.lavDD}"/>`).join('')}</g>`;

const roll = (x, y, r, c1, c2) => `
  <g filter="url(#soft)">
    <circle cx="${x}" cy="${y}" r="${r}" fill="${c1}" stroke="${c2}" stroke-width="2"/>
    ${[0.8, 0.62, 0.45].map((k) => `<circle cx="${x}" cy="${y}" r="${r * k}" fill="none" stroke="${c2}" stroke-opacity="0.55" stroke-width="1.6"/>`).join('')}
    <circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="#FFF" stroke="${c2}" stroke-width="2"/>
    <path d="M${x - r * 0.7} ${y - r * 0.45} A ${r * 0.85} ${r * 0.85} 0 0 1 ${x - r * 0.1} ${y - r * 0.82}" stroke="#FFF" stroke-opacity="0.7" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>`;

const spool = (x, y, c) => `
  <g filter="url(#soft)">
    <rect x="${x - 34}" y="${y - 70}" width="68" height="12" rx="4" fill="#EADBC8" stroke="#B89B7A" stroke-width="1.5"/>
    <rect x="${x - 26}" y="${y - 58}" width="52" height="96" fill="${c}"/>
    ${Array.from({ length: 15 }, (_, i) => `<line x1="${x - 26}" y1="${y - 54 + i * 6.2}" x2="${x + 26}" y2="${y - 52 + i * 6.2}" stroke="#FFF" stroke-opacity="0.35" stroke-width="1.4"/>`).join('')}
    <rect x="${x - 34}" y="${y + 38}" width="68" height="12" rx="4" fill="#EADBC8" stroke="#B89B7A" stroke-width="1.5"/>
  </g>`;

const garmentFold = (x, y, w, h, c, edge) => `
  <g filter="url(#soft)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${c}" stroke="${edge}" stroke-width="2"/>
    <path d="M${x + 12} ${y + h * 0.5} H${x + w - 12}" stroke="${edge}" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="2 6"/>
    <path d="M${x + w * 0.42} ${y} q ${w * 0.08} ${h * 0.35} ${w * 0.16} 0" fill="none" stroke="${edge}" stroke-width="2" opacity="0.7"/>
  </g>`;

const bubbles = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF" fill-opacity="0.45" stroke="#A98BD0" stroke-opacity="0.7" stroke-width="2"/><path d="M${x - r * 0.45} ${y - r * 0.1} a ${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.4} ${-r * 0.4}" stroke="#FFF" stroke-width="1.6" fill="none"/>`).join('');

// ---------- department artwork ----------
const ART = {
  PROGRAMMING: ['lavender', `
    <path d="M60 300 C 170 245, 270 345, 600 262" stroke="#F1F7C4" stroke-width="22" fill="none" stroke-linecap="round" filter="url(#soft)"/>
    <path d="M60 300 C 170 245, 270 345, 600 262" stroke="#8C8F5A" stroke-width="9" fill="none" stroke-dasharray="1.6 8"/>
    <g filter="url(#soft)">
      <path d="M250 118 L300 106 Q320 136 340 106 L390 118 L408 170 L386 176 L398 322 L242 322 L254 176 L232 170 Z" fill="#FFF" fill-opacity="0.55" stroke="${L.lavD}" stroke-width="2.5" stroke-dasharray="9 6" stroke-linejoin="round"/>
      <path d="M320 160 V290 M312 172 L320 160 L328 172 M312 278 L320 290 L328 278" stroke="${L.lavD}" stroke-width="2" fill="none"/>
      <path d="M438 186 Q482 152 526 186 L548 306 L416 306 Z" fill="#FFF" fill-opacity="0.5" stroke="${L.lavD}" stroke-width="2.5" stroke-dasharray="9 6" stroke-linejoin="round"/>
    </g>
    ${[[228, 160], [412, 300], [536, 190]].map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${x + 22}" y2="${y + 16}" stroke="#9A93A3" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="7" fill="${L.tom}" filter="url(#soft)"/>`).join('')}`],

  STORE: ['lilac', `
    ${roll(170, 284, 50, '#E7D6F3', L.lavD)}${roll(275, 284, 50, '#FAD9D2', '#D9826F')}${roll(380, 284, 50, '#EEF4C2', '#9DAA3E')}${roll(485, 284, 50, '#DCD3EA', L.lavDD)}
    ${roll(222, 196, 50, '#FBE5DF', '#D9826F')}${roll(327, 196, 50, '#E2CFF0', L.lavD)}${roll(432, 196, 50, '#F3F0F7', '#8E86A0')}
    ${roll(275, 108, 50, '#EEF4C2', '#9DAA3E')}${roll(380, 108, 50, '#E7D6F3', L.lavD)}`],

  DYEING: ['blush', `
    <rect x="80" y="62" width="480" height="10" rx="5" fill="#C9B9D6" filter="url(#soft)"/>
    ${[['#F3E7FA', '#8E5AB5'], ['#FDEDEA', '#FF6347'], ['#F7FBE2', '#B9CC2E'], ['#EFE8F5', '#6E4590'], ['#FCEFF3', '#D86A8A']].map(([a, b], i) => {
      const x = 98 + i * 92;
      return `<linearGradient id="dye${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}" stop-opacity="0.85"/></linearGradient>
      <path d="M${x} 70 H${x + 78} V${292 + (i % 2) * 18} q -10 14 -20 0 t -19 0 t -19 0 t -20 0 Z" fill="url(#dye${i})" filter="url(#soft)"/>
      <path d="M${x + 26} 74 V${280 + (i % 2) * 18}" stroke="#FFF" stroke-opacity="0.35" stroke-width="6"/>
      <path d="M${x + 39} ${318 + (i % 2) * 14} q 6 10 0 16 q -6 -6 0 -16 Z" fill="${b}" fill-opacity="0.75"/>`;
    }).join('')}`],

  QC1: ['lavender', `
    ${['#F3E7FA', '#E2CFF0', '#CDA9E6', '#B57EDC', '#9A66C4', '#7E4FA3'].map((c, i) => `<g transform="rotate(${-24 + i * 9} 210 330)" filter="url(#soft)"><rect x="186" y="130" width="48" height="190" rx="10" fill="${c}" stroke="#FFF" stroke-width="3"/><rect x="194" y="290" width="32" height="5" rx="2" fill="#FFF" fill-opacity="0.7"/></g>`).join('')}
    ${magnifier(430, 205, 80, `<path d="M350 205 H510" stroke="${L.lavD}" stroke-width="6" stroke-dasharray="16 10"/>`)}
    ${check(500, 140, 26)}`],

  EMBROIDERY: ['lime', `
    <g filter="url(#soft)">
      <circle cx="320" cy="214" r="128" fill="#FFF" fill-opacity="0.5" stroke="#D8B98F" stroke-width="12"/>
      <circle cx="320" cy="214" r="114" fill="none" stroke="#C4A374" stroke-width="3"/>
      <rect x="306" y="72" width="28" height="18" rx="4" fill="#C4A374"/>
    </g>
    ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="320" cy="168" rx="20" ry="42" transform="rotate(${a} 320 214)" fill="${L.tomL}" stroke="${L.tom}" stroke-width="2"/><line x1="320" y1="186" x2="320" y2="138" transform="rotate(${a} 320 214)" stroke="#FFF" stroke-opacity="0.7" stroke-width="2" stroke-dasharray="3 4"/>`).join('')}
    <circle cx="320" cy="214" r="18" fill="${L.chart}" stroke="${L.chartM}" stroke-width="3"/>
    ${[[230, 270, -35], [410, 270, 35], [250, 150, -140], [392, 150, 140]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="26" transform="rotate(${r} ${x} ${y})" fill="#C9D86A" stroke="#8E9C34" stroke-width="2"/>`).join('')}
    ${[[268, 112], [372, 112], [210, 214], [430, 214]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${L.lav}" stroke="${L.lavD}" stroke-width="2"/>`).join('')}
    <path d="M440 300 C 500 330, 540 270, 600 300" stroke="${L.tom}" stroke-width="2.5" fill="none"/>`],

  THREAD_CUTTING: ['lilac', `
    ${spool(120, 250, L.lav)}${spool(205, 262, L.tomL)}${spool(290, 250, '#D7E46A')}
    <path d="M146 220 C 230 160, 330 300, 420 210 S 560 170, 610 230" stroke="${L.lavD}" stroke-width="2.5" fill="none"/>
    <path d="M230 236 C 300 200, 360 320, 470 260" stroke="${L.tom}" stroke-width="2" fill="none" opacity="0.8"/>
    ${scissors(440, 248, 1.05, -18)}
    ${[[580, 290], [596, 300], [570, 308], [520, 312]].map(([x, y], i) => `<path d="M${x} ${y} q 8 -10 16 -2" stroke="${i % 2 ? L.tom : L.lavD}" stroke-width="2" fill="none"/>`).join('')}`],

  QC2: ['lavender', `
    <path d="M0 236 C 160 210, 420 262, 640 222" stroke="${L.lavD}" stroke-width="3" fill="none" stroke-dasharray="14 9" opacity="0.8"/>
    <path d="M0 252 C 160 226, 420 278, 640 238" stroke="${L.lavL}" stroke-width="2" fill="none"/>
    ${[[110, 228], [180, 222]].map(([x, y]) => `<path d="M${x} ${y} q 6 -14 14 -18 M${x + 4} ${y} q 10 -8 18 -6" stroke="${L.tom}" stroke-width="2" fill="none"/>`).join('')}
    ${magnifier(380, 200, 92, `<path d="M280 232 C 340 222, 420 248, 480 238" stroke="${L.lavD}" stroke-width="7" fill="none" stroke-dasharray="26 16"/>`)}
    ${check(470, 120, 24)}`],

  WASHING: ['mist', `
    <path d="M0 220 C 100 180, 200 260, 320 214 S 520 170, 640 214 V360 H0Z" fill="#C6D0EC" filter="url(#soft)"/>
    <path d="M0 262 C 120 228, 230 300, 350 258 S 540 226, 640 258 V360 H0Z" fill="#D7C2EC" filter="url(#soft)"/>
    <path d="M0 302 C 140 276, 250 330, 380 298 S 560 280, 640 300 V360 H0Z" fill="#EADDF5" filter="url(#soft)"/>
    <path d="M40 252 C 120 226, 220 282, 320 244" stroke="#FFF" stroke-width="4" fill="none" opacity="0.7"/>
    ${bubbles([[150, 160, 18], [200, 120, 10], [420, 140, 22], [470, 96, 12], [530, 170, 9], [300, 150, 13], [360, 110, 7]])}`],

  QC3: ['mist', `
    ${garmentFold(150, 252, 250, 58, '#EDE4F6', L.lavD)}${garmentFold(166, 198, 220, 58, '#E1E8F6', '#7C8DB5')}${garmentFold(182, 146, 190, 56, '#F7F3FB', L.lavD)}
    ${tag(470, 236, check(470, 172, 20).replace('filter="url(#soft)"', ''))}
    ${bubbles([[110, 160, 12], [86, 120, 7], [560, 120, 10], [590, 170, 6]])}`],

  RECUTTING: ['blush', `
    <g filter="url(#soft)">
      <path d="M70 140 L560 120 L590 320 L90 330 Z" fill="#FDF4F2" fill-opacity="0.75" stroke="#E7B8AD" stroke-width="2"/>
      <path d="M80 130 L570 110" stroke="#F1CFC6" stroke-width="2"/>
    </g>
    <path d="M140 170 h120 l20 120 h-150 Z" fill="none" stroke="${L.lavD}" stroke-width="2.5" stroke-dasharray="8 6"/>
    <path d="M330 170 q 40 -30 80 0 l 16 110 h-112 Z" fill="none" stroke="${L.lavD}" stroke-width="2.5" stroke-dasharray="8 6"/>
    <path d="M110 300 L420 292" stroke="${L.tom}" stroke-width="3" stroke-dasharray="12 8"/>
    ${scissors(520, 286, 0.9, 178)}`],

  STITCHING: ['lavender', `
    <path d="M0 150 L640 230 V360 H0 Z" fill="#E7D6F3" filter="url(#soft)"/>
    <path d="M0 178 L640 258" stroke="${L.lavDD}" stroke-width="3" stroke-dasharray="14 8"/>
    <path d="M0 196 L640 276" stroke="${L.lavD}" stroke-width="2" stroke-dasharray="10 8" opacity="0.7"/>
    <path d="M0 160 L640 240" stroke="#FFF" stroke-opacity="0.6" stroke-width="2"/>
    <g filter="url(#soft)" transform="rotate(-32 450 150)">
      <rect x="360" y="146" width="190" height="8" rx="4" fill="#E6E3EA" stroke="#8E86A0" stroke-width="1.5"/>
      <path d="M550 146 L590 150 L550 154 Z" fill="#E6E3EA" stroke="#8E86A0" stroke-width="1.5"/>
      <ellipse cx="380" cy="150" rx="12" ry="2.2" fill="#FFF"/>
    </g>
    <path d="M378 196 C 320 140, 240 120, 170 180 S 90 260, 40 200" stroke="${L.tom}" stroke-width="2.5" fill="none"/>`],

  FINISHING: ['lilac', `
    <rect x="270" y="0" width="100" height="360" fill="#F7F0FB" stroke="${L.lavL}" stroke-width="2" filter="url(#soft)"/>
    <path d="M282 0 V360 M358 0 V360" stroke="${L.lavD}" stroke-width="1.6" stroke-dasharray="6 5" opacity="0.7"/>
    ${[110, 180, 250].map((y) => button(320, y, 18, '#FFF8F0')).join('')}
    <path d="M0 300 ${Array.from({ length: 17 }, (_, i) => `q 20 ${i % 1 === 0 ? 24 : 0} 40 0`).join(' ')} V360 H0Z" fill="#FFF" fill-opacity="0.85" stroke="${L.lav}" stroke-width="2" filter="url(#soft)"/>
    ${Array.from({ length: 16 }, (_, i) => `<circle cx="${20 + i * 40}" cy="314" r="4" fill="none" stroke="${L.lav}" stroke-width="1.6"/>`).join('')}
    ${[[120, 150, '#FAD9D2'], [520, 170, '#EEF4C2'], [470, 120, '#E2CFF0']].map(([x, y, c]) => button(x, y, 13, c)).join('')}`],

  STEAM_PRESS: ['lavender', `
    <path d="M0 290 C 160 270, 480 300, 640 280 V360 H0Z" fill="#F7F0FB" filter="url(#soft)"/>
    <g filter="url(#soft)">
      <path d="M200 280 C 210 220, 260 196, 340 196 L470 196 C 482 196, 488 206, 486 220 L478 280 Z" fill="#FFF" stroke="${L.lavD}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M204 280 H478 L476 292 H200 Z" fill="${L.lav}"/>
      <path d="M300 196 C 300 150, 330 140, 380 140 H440 C 462 140, 466 160, 456 196" fill="none" stroke="${L.lavD}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="420" cy="238" r="9" fill="${L.chart}" stroke="${L.chartM}" stroke-width="2"/>
      <path d="M240 262 H460" stroke="${L.lavL}" stroke-width="3" stroke-linecap="round"/>
    </g>
    ${[[230, 0], [270, 16], [310, 4]].map(([x, d]) => `<path d="M${x} ${180 - d} c -18 -20, 18 -34, 0 -56 s 18 -34, 0 -56" stroke="#FFF" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.95"/><path d="M${x} ${180 - d} c -18 -20, 18 -34, 0 -56 s 18 -34, 0 -56" stroke="${L.lav}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>`).join('')}`],

  FINAL_CHECK: ['lavender', `
    <g filter="url(#soft)">
      <path d="M320 54 c 0 -18 22 -18 22 -4 c 0 10 -10 12 -22 22" stroke="#9A93A3" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M200 112 L320 72 L440 112" stroke="#C4A374" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <linearGradient id="kurta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E7FA"/><stop offset="1" stop-color="#CDA9E6"/></linearGradient>
      <path d="M280 96 Q320 126 360 96 L420 116 L470 196 L436 214 L410 176 L420 330 L220 330 L230 176 L204 214 L170 196 L220 116 Z" fill="url(#kurta)" stroke="${L.lavD}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M296 104 Q320 160 344 104" fill="none" stroke="${L.lavD}" stroke-width="2"/>
      <path d="M226 300 H414" stroke="${L.tom}" stroke-width="3" stroke-dasharray="2 6"/>
      <path d="M228 312 H412" stroke="${L.lavD}" stroke-width="2" stroke-dasharray="10 5"/>
    </g>
    ${tag(520, 250, check(520, 186, 20).replace('filter="url(#soft)"', ''))}`],

  PACKING: ['lime', `
    ${garmentFold(90, 258, 210, 54, '#E7D6F3', L.lavD)}${garmentFold(102, 206, 186, 54, '#FAD9D2', '#D9826F')}${garmentFold(114, 156, 162, 52, '#F7F0FB', L.lavD)}
    <g filter="url(#soft)">
      <path d="M350 170 L560 170 L560 316 L350 316 Z" fill="#EFE5F7" stroke="${L.lavD}" stroke-width="2.5"/>
      <path d="M350 170 L380 130 L590 130 L560 170 Z" fill="#F7F0FB" stroke="${L.lavD}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M560 170 L590 130 L590 276 L560 316 Z" fill="#E2CFF0" stroke="${L.lavD}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M445 170 V316 M455 170 V316" stroke="${L.tom}" stroke-width="5"/>
      <path d="M470 130 L440 170" stroke="${L.tom}" stroke-width="5"/>
      <path d="M450 170 c -30 -34 -50 -6 0 0 c 50 -6 30 -34 0 0" fill="${L.tomL}" stroke="${L.tom}" stroke-width="2.5"/>
      <rect x="378" y="268" width="56" height="30" rx="3" fill="#FFF" stroke="${L.lavD}" stroke-width="1.5"/>
      <path d="M386 278 h40 M386 288 h28" stroke="${L.lavL}" stroke-width="3"/>
    </g>`],
};

for (const [code, [tint, motif]] of Object.entries(ART)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="1280" height="720" preserveAspectRatio="xMidYMid slice">${base(tint)}${motif}${finish}\n</svg>\n`;
  fs.writeFileSync(path.join(outDir, `${code.toLowerCase().replace(/_/g, '-')}.svg`), svg);
}
console.log('wrote', Object.keys(ART).length, 'svgs to', outDir);
