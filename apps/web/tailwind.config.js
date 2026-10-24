/** @type {import('tailwindcss').Config} */

// Shubham Fabrics MES colour system. Every colour comes from the CSS variables in
// src/app/globals.css, so the palette is defined in exactly one place.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (name) =>
  Object.fromEntries(SHADES.map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`]));

const lavender = scale('lavender'); // primary brand
const chartreuse = scale('chartreuse'); // secondary accent / positive progress
const tomato = scale('tomato'); // critical actions, rejection, errors
const ink = scale('ink'); // neutrals: text, borders, surfaces

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'Manrope', 'sans-serif'],
      },
      // A bare `ring` uses the brand focus colour instead of Tailwind's default blue.
      ringColor: {
        DEFAULT: 'rgb(var(--lavender-500) / 0.5)',
      },
      colors: {
        // Theme tokens — use these names in new code.
        lavender,
        chartreuse,
        tomato,
        ink,
        brand: lavender,
        accent: chartreuse,
        danger: tomato,
        factory: ink,

        // Existing modules use Tailwind's default colour names. They are mapped onto the
        // brand palette here so every department follows the same system without
        // rewriting working screens:
        //   neutrals -> ink, cool/brand hues -> lavender,
        //   positive and highlight hues -> chartreuse, alert hues -> tomato.
        slate: ink,
        gray: ink,
        zinc: ink,
        neutral: ink,
        stone: ink,
        purple: lavender,
        violet: lavender,
        indigo: lavender,
        blue: lavender,
        sky: lavender,
        cyan: lavender,
        teal: lavender,
        fuchsia: lavender,
        pink: lavender,
        emerald: chartreuse,
        green: chartreuse,
        lime: chartreuse,
        amber: chartreuse,
        yellow: chartreuse,
        rose: tomato,
        red: tomato,
        orange: tomato,
      },
    },
  },
  plugins: [],
};
