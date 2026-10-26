/** @type {import('tailwindcss').Config} */

// Subham Fabrics MES design tokens.
// The palette is intentionally closed: only these colors exist as Tailwind
// utilities, so off-brand classes (indigo, emerald, slate...) generate nothing.
// Values live as RGB channels in src/app/globals.css (:root) so opacity
// modifiers like `bg-brand-500/10` keep working.
//
//   brand   Lavender  #B57EDC  primary actions, active nav/tabs, focus, links
//   accent  Chartreuse #DFFF00 progress, small accent borders, highlights (dark text only)
//   danger  Tomato    #FF6347  destructive actions, rejections, critical errors
//   neutral           #F8F7FA canvas, #E5E1E8 line, #6B6872 muted, #25232A ink
//
// White text only sits on brand-600+ / danger-600+ (WCAG AA).
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const scale = (name, defaultShade) => {
  const out = { DEFAULT: `rgb(var(--${name}-${defaultShade}) / <alpha-value>)` };
  for (const s of SHADES) out[s] = `rgb(var(--${name}-${s}) / <alpha-value>)`;
  return out;
};

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: 'rgb(var(--neutral-0) / <alpha-value>)',
      black: '#000000',
      brand: scale('brand', 500),
      accent: scale('accent', 400),
      danger: scale('danger', 500),
      neutral: scale('neutral', 500),
      // Semantic neutral aliases
      canvas: 'rgb(var(--neutral-50) / <alpha-value>)',
      surface: 'rgb(var(--neutral-0) / <alpha-value>)',
      line: 'rgb(var(--neutral-200) / <alpha-value>)',
      muted: 'rgb(var(--neutral-500) / <alpha-value>)',
      ink: 'rgb(var(--neutral-900) / <alpha-value>)',
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
      },
      ringColor: {
        DEFAULT: 'rgb(var(--brand-500) / 0.5)',
      },
      // Elevation scale: light from above, soft ink-tinted shadows (each step = a tight contact
      // shadow + a wider ambient one). `2xs`/`xs` are also the names already used in the markup.
      boxShadow: {
        '2xs': '0 1px 2px 0 rgb(37 35 42 / 0.05)',
        xs: '0 1px 2px 0 rgb(37 35 42 / 0.06), 0 2px 6px -2px rgb(37 35 42 / 0.08)',
        sm: '0 1px 2px 0 rgb(37 35 42 / 0.06), 0 4px 10px -3px rgb(37 35 42 / 0.10)',
        DEFAULT: '0 1px 3px 0 rgb(37 35 42 / 0.07), 0 6px 14px -4px rgb(37 35 42 / 0.12)',
        md: '0 2px 4px -1px rgb(37 35 42 / 0.07), 0 10px 20px -6px rgb(37 35 42 / 0.14)',
        lg: '0 4px 8px -2px rgb(37 35 42 / 0.08), 0 16px 32px -10px rgb(37 35 42 / 0.18)',
        xl: '0 6px 12px -4px rgb(37 35 42 / 0.10), 0 24px 44px -14px rgb(37 35 42 / 0.22)',
        '2xl': '0 10px 20px -8px rgb(37 35 42 / 0.12), 0 36px 64px -18px rgb(37 35 42 / 0.28)',
        inner: 'inset 0 1px 2px 0 rgb(37 35 42 / 0.06)',
      },
      dropShadow: {
        xs: '0 1px 1px rgb(255 255 255 / 0.6)',
      },
      backdropBlur: {
        '2xs': '1px',
        xs: '2px',
      },
    },
  },
  plugins: [],
};
